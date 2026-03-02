const fs = require('fs');
const path = require('path');

const schema = fs.readFileSync(path.join(__dirname, '..', 'prisma', 'schema.prisma'), 'utf8');

// Parse enums
const enums = new Set();
for (const m of schema.matchAll(/^enum\s+(\w+)\s*\{/gm)) enums.add(m[1]);

// Prisma to SQL type mapping
function toSql(prismaType, line) {
  const dbDec = line.match(/@db\.Decimal\((\d+),\s*(\d+)\)/);
  if (prismaType === 'String') return 'VARCHAR';
  if (prismaType === 'Int') return 'INT';
  if (prismaType === 'BigInt') return 'BIGINT';
  if (prismaType === 'Float') return 'FLOAT';
  if (prismaType === 'Decimal') return dbDec ? `DECIMAL_${dbDec[1]}_${dbDec[2]}` : 'DECIMAL';
  if (prismaType === 'Boolean') return 'BOOLEAN';
  if (prismaType === 'DateTime') return 'TIMESTAMPTZ';
  if (prismaType === 'Json') return 'JSONB';
  if (enums.has(prismaType)) return `ENUM_${prismaType}`;
  return 'TEXT';
}

function toSnake(s) { return s.replace(/([A-Z])/g, '_$1').toLowerCase(); }

// Parse models
const models = [];
const modelRegex = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm;
let match;
while ((match = modelRegex.exec(schema)) !== null) {
  const name = match[1];
  const body = match[2];
  let tableName = name;
  const mapMatch = body.match(/@@map\("([^"]+)"\)/);
  if (mapMatch) tableName = mapMatch[1];

  const fields = [];
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@') || trimmed.startsWith('}')) continue;

    const parts = trimmed.split(/\s+/);
    const fieldName = parts[0];
    if (!fieldName || fieldName.startsWith('@')) continue;

    let prismaType = parts[1];
    if (!prismaType) continue;
    if (prismaType.endsWith('[]')) continue; // Skip array relations

    const isOptional = prismaType.endsWith('?');
    prismaType = prismaType.replace('?', '');

    // Skip relation fields (model references without @relation fields mapping)
    if (!['String','Int','BigInt','Float','Decimal','Boolean','DateTime','Json'].includes(prismaType) && !enums.has(prismaType)) {
      continue;
    }

    const isPK = trimmed.includes('@id');
    const isUnique = trimmed.includes('@unique');
    const relationMatch = body.match(new RegExp(`@relation\\([^)]*fields:\\s*\\[${fieldName}\\]`));
    const isFK = !!relationMatch || (/Id$/.test(fieldName) && !isPK);

    let constraint = '';
    if (isPK) constraint = 'PK';
    else if (isFK) constraint = 'FK';
    else if (isUnique) constraint = 'UK';

    const sqlType = toSql(prismaType, trimmed);
    const snakeName = toSnake(fieldName);

    fields.push({ name: snakeName, type: sqlType, constraint });
  }

  models.push({ name, tableName, fields });
}

// Extract relationships
const relationships = [];
for (const model of models) {
  const bodyMatch = schema.match(new RegExp(`model\\s+${model.name}\\s*\\{([\\s\\S]*?)^\\}`, 'm'));
  if (!bodyMatch) continue;
  const body = bodyMatch[1];
  const relRegex = /@relation\([^)]*fields:\s*\[(\w+)\][^)]*references:\s*\[(\w+)\]/g;
  let rm;
  while ((rm = relRegex.exec(body)) !== null) {
    const lineWithRel = body.split('\n').find(l => l.includes(rm[0]));
    if (lineWithRel) {
      const refModel = lineWithRel.trim().split(/\s+/)[1]?.replace('?','');
      if (refModel) {
        const targetModel = models.find(m => m.name === refModel);
        if (targetModel) {
          // Determine cardinality: check if FK has @unique -> 1:1, else 1:N
          const fkField = rm[1];
          const fkLine = body.split('\n').find(l => l.trim().startsWith(fkField + ' '));
          const isOneToOne = fkLine && fkLine.includes('@unique');
          relationships.push({
            from: targetModel.tableName,
            to: model.tableName,
            type: isOneToOne ? '||--||' : '||--o{',
            label: toSnake(rm[1])
          });
        }
      }
    }
  }
}

// Generate Mermaid ERD
let mermaid = '```mermaid\nerDiagram\n';

// Add entities
for (const model of models) {
  mermaid += `    ${model.tableName} {\n`;
  for (const f of model.fields) {
    const constraintStr = f.constraint ? ` ${f.constraint}` : '';
    mermaid += `        ${f.type} ${f.name}${constraintStr}\n`;
  }
  mermaid += '    }\n\n';
}

// Add relationships
for (const rel of relationships) {
  mermaid += `    ${rel.from} ${rel.type} ${rel.to} : "${rel.label}"\n`;
}

mermaid += '```\n';

// Write to .md file
const outFile = path.join(__dirname, 'IntelliRentOps_physical_ERD.md');
fs.writeFileSync(outFile, `# IntelliRentOps - Physical Database ERD\n\n${mermaid}`, 'utf8');
console.log('Done:', outFile);
console.log('Models:', models.length, '| Relationships:', relationships.length);
