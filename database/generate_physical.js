const fs = require('fs');
const path = require('path');

const schema = fs.readFileSync(path.join(__dirname, '..', 'prisma', 'schema.prisma'), 'utf8');

// Parse enums
const enums = new Set();
for (const m of schema.matchAll(/^enum\s+(\w+)\s*\{/gm)) enums.add(m[1]);

function toSql(prismaType, line) {
  const dbDec = line.match(/@db\.Decimal\((\d+),\s*(\d+)\)/);
  if (prismaType === 'String') return 'VARCHAR(255)';
  if (prismaType === 'Int') return 'INT';
  if (prismaType === 'BigInt') return 'BIGINT';
  if (prismaType === 'Float') return 'FLOAT';
  if (prismaType === 'Decimal') return dbDec ? `DECIMAL(${dbDec[1]},${dbDec[2]})` : 'DECIMAL';
  if (prismaType === 'Boolean') return 'BOOLEAN';
  if (prismaType === 'DateTime') return 'TIMESTAMPTZ';
  if (prismaType === 'Json') return 'JSONB';
  if (enums.has(prismaType)) return prismaType;
  return 'TEXT';
}

function toSnake(s) { return s.replace(/([A-Z])/g, '_$1').toLowerCase(); }
function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

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
    if (prismaType.endsWith('[]')) continue;
    const isOptional = prismaType.endsWith('?');
    prismaType = prismaType.replace('?', '');
    if (!['String','Int','BigInt','Float','Decimal','Boolean','DateTime','Json'].includes(prismaType) && !enums.has(prismaType)) continue;

    const isPK = trimmed.includes('@id');
    const relationMatch = body.match(new RegExp(`@relation\\([^)]*fields:\\s*\\[${fieldName}\\]`));
    const isFK = !!relationMatch || (/Id$/.test(fieldName) && !isPK);

    let constraint = '';
    if (isPK) constraint = 'PK';
    else if (isFK) constraint = 'FK';

    fields.push({ name: toSnake(fieldName), type: toSql(prismaType, trimmed), constraint, original: fieldName });
  }
  models.push({ name, tableName, fields });
}

// Extract FK relationships
const relationships = [];
for (const model of models) {
  const bodyMatch = schema.match(new RegExp(`model\\s+${model.name}\\s*\\{([\\s\\S]*?)^\\}`, 'm'));
  if (!bodyMatch) continue;
  const body = bodyMatch[1];
  const relRegex = /@relation\([^)]*fields:\s*\[(\w+)\][^)]*references:\s*\[(\w+)\]/g;
  let rm;
  while ((rm = relRegex.exec(body)) !== null) {
    const fkField = rm[1];
    const lineWithRel = body.split('\n').find(l => l.includes(rm[0]));
    if (lineWithRel) {
      const refModel = lineWithRel.trim().split(/\s+/)[1]?.replace('?','');
      if (refModel) {
        const targetModel = models.find(m => m.name === refModel);
        if (targetModel) {
          const srcRowIdx = model.fields.findIndex(f => f.original === fkField);
          relationships.push({ src: model.tableName, tgt: targetModel.tableName, srcField: fkField, srcRowIdx });
        }
      }
    }
  }
}

// Color categories
function getColor(tn) {
  if (['guests','users','staff','operators','admins','partners'].includes(tn)) return ['#d5e8d4','#82b366'];
  if (['apartments','rooms'].includes(tn)) return ['#fff2cc','#d6b656'];
  if (['rental_contracts','user_contract_members'].includes(tn)) return ['#e1d5e7','#9673a6'];
  if (['contact_requests','booking_requests','appointments','partner_requests'].includes(tn)) return ['#f8cecc','#b85450'];
  if (['tasks','maintenance_requests','tickets'].includes(tn)) return ['#ffe6cc','#d79b00'];
  if (['invoices','payments'].includes(tn)) return ['#dae8fc','#6c8ebf'];
  if (['iot_devices','utility_meters','utility_readings'].includes(tn)) return ['#b0e3e6','#73a6a6'];
  if (['policies','legal_documents'].includes(tn)) return ['#f5f5f5','#666666'];
  if (['activity_logs','notifications','staff_notes'].includes(tn)) return ['#e6e6e6','#808080'];
  return ['#fce5cd','#d6a052'];
}

// Improved Layout Grid to avoid lines crossing over tables
// Increasing horizontal and vertical gaps substantially
const layout = {
  // Column 1 (x: 0)
  'guests':        [0, 0],
  'contact_requests': [0, 800],
  'booking_requests': [0, 1600],
  'appointments':     [0, 2400],
  'policies':         [0, 3200],

  // Column 2 (x: 600)
  'users':         [600, 0],
  'apartments':    [600, 800],
  'rooms':         [600, 1600],
  'legal_documents': [600, 3200],

  // Column 3 (x: 1200)
  'rental_contracts': [1200, 800],
  'invoices':         [1200, 2000],
  'payments':         [1200, 2800],

  // Column 4 (x: 1800)
  'staff':         [1800, 0],
  'user_contract_members': [1800, 800],
  'maintenance_requests': [1800, 1600],
  'tickets':              [1800, 2400],

  // Column 5 (x: 2400)
  'operators':      [2400, 0],
  'tasks':          [2400, 800],
  'activity_logs':  [2400, 1600],
  'notifications':  [2400, 2400],

  // Column 6 (x: 3000)
  'partners':       [3000, 0],
  'partner_requests': [3000, 800],
  'iot_devices':      [3000, 1600],
  'utility_meters':   [3000, 2400],
  'utility_readings': [3000, 3200],

  // Column 7 (x: 3600)
  'admins':         [3600, 0],
  'staff_notes':    [3600, 800],
  'refresh_tokens': [3600, 1600],
  'password_reset_tokens': [3600, 2400],
  'otp_verifications':     [3600, 3200],
  'pending_guest_registrations': [3600, 3800],
};


let id = 10;
const nid = () => `c${id++}`;

const COL1_W = 30;
const COL2_W = 280;
const TBL_W = COL1_W + COL2_W;
const ROW_H = 26;
const HDR_H = 28;

let xml = '';
const tableIds = {};
const rowIds = {};

for (const model of models) {
  const tn = model.tableName;
  const pos = layout[tn] || [0, 0];
  const [fillColor, strokeColor] = getColor(tn);
  const tblH = HDR_H + model.fields.length * ROW_H;
  const tblId = nid();
  tableIds[tn] = tblId;
  rowIds[tn] = [];

  xml += `<mxCell id="${tblId}" value="${esc(tn)}" style="shape=table;startSize=${HDR_H};container=1;collapsible=0;childLayout=tableLayout;fixedRows=1;rowLines=0;fontStyle=1;align=center;resizeLast=1;fillColor=${fillColor};strokeColor=${strokeColor};fontColor=#333333;fontSize=13;" vertex="1" parent="1">
  <mxGeometry x="${pos[0]}" y="${pos[1]}" width="${TBL_W}" height="${tblH}" as="geometry"/>
</mxCell>\n`;

  let rowY = HDR_H;
  for (let i = 0; i < model.fields.length; i++) {
    const f = model.fields[i];
    const rowId = nid();
    rowIds[tn].push(rowId);
    const isLast = i === model.fields.length - 1;

    xml += `<mxCell id="${rowId}" value="0" style="shape=tableRow;horizontal=0;startSize=0;swimlaneHead=0;swimlaneBody=0;fillColor=none;collapsible=0;dropTarget=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;fontSize=11;top=0;left=0;right=0;bottom=${isLast?0:1};" vertex="1" parent="${tblId}">
  <mxGeometry y="${rowY}" width="${TBL_W}" height="${ROW_H}" as="geometry"/>
</mxCell>\n`;

    const c1 = nid();
    xml += `<mxCell id="${c1}" value="${f.constraint}" style="shape=partialRectangle;connectable=0;fillColor=none;top=0;left=0;bottom=0;right=1;fontStyle=${f.constraint==='PK'?1:0};overflow=hidden;fontSize=10;fontColor=#666666;align=center;" vertex="1" parent="${rowId}">
  <mxGeometry width="${COL1_W}" height="${ROW_H}" as="geometry"><mxRectangle width="${COL1_W}" height="${ROW_H}" as="alternateBounds"/></mxGeometry>
</mxCell>\n`;

    const c2 = nid();
    const cellValue = `${esc(f.name)}: ${esc(f.type)}`;
    xml += `<mxCell id="${c2}" value="${cellValue}" style="shape=partialRectangle;connectable=0;fillColor=none;top=0;left=0;bottom=0;right=0;overflow=hidden;fontSize=11;spacingLeft=4;" vertex="1" parent="${rowId}">
  <mxGeometry x="${COL1_W}" width="${COL2_W}" height="${ROW_H}" as="geometry"><mxRectangle width="${COL2_W}" height="${ROW_H}" as="alternateBounds"/></mxGeometry>
</mxCell>\n`;

    rowY += ROW_H;
  }
}

// Generate edges with custom routing options
// edgeStyle=orthogonalEdgeStyle;edgeStyle=entityRelationEdgeStyle
for (const rel of relationships) {
  const srcTblId = tableIds[rel.src];
  const tgtTblId = tableIds[rel.tgt];
  if (!srcTblId || !tgtTblId) continue;
  
  const srcRowId = rowIds[rel.src]?.[rel.srcRowIdx] || srcTblId;
  const tgtRowId = rowIds[rel.tgt]?.[0] || tgtTblId;
  
  // Entity relation edge style routes lines cleanly around rectangles
  const edgeId = nid();
  xml += `<mxCell id="${edgeId}" value="" edge="1" parent="1" source="${srcRowId}" target="${tgtRowId}" style="edgeStyle=entityRelationEdgeStyle;rounded=1;orthogonalLoop=1;jetSize=auto;endArrow=ERmany;startArrow=ERone;startFill=0;endFill=0;strokeColor=#666666;">
  <mxGeometry relative="1" as="geometry"/>
</mxCell>\n`;
}

const output = `<mxfile host="Electron" agent="draw.io" version="29.5.2">
  <diagram name="IntelliRentOps Physical DB" id="physDB01">
    <mxGraphModel dx="4000" dy="3000" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="0" pageScale="1" pageWidth="8000" pageHeight="6000" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
${xml}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;

const outFile = path.join(__dirname, 'IntelliRentOps_physical.drawio');
fs.writeFileSync(outFile, output, 'utf8');
console.log('Done:', outFile);
console.log('Models:', models.length, '| Relationships:', relationships.length);
