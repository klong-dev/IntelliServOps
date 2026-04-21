const fs = require('fs');
const path = require('path');

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildDiagram(name, entities, options = {}) {
  let id = 2;
  const nextId = () => String(id++);

  const cells = [];
  cells.push('<mxCell id="0"/>');
  cells.push('<mxCell id="1" parent="0"/>');

  const titleId = nextId();
  cells.push(
    `<mxCell id="${titleId}" value="${esc(options.title || name)}" style="text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;fontSize=22;fontStyle=1;fontColor=#111111;" vertex="1" parent="1"><mxGeometry x="30" y="20" width="1200" height="36" as="geometry"/></mxCell>`,
  );

  const subtitle =
    options.subtitle ||
    'Only explicit transitions from production code/API are visualized.';
  const subId = nextId();
  cells.push(
    `<mxCell id="${subId}" value="${esc(subtitle)}" style="text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;fontSize=12;fontColor=#4a4a4a;" vertex="1" parent="1"><mxGeometry x="30" y="54" width="1200" height="24" as="geometry"/></mxCell>`,
  );

  const blockWidth = 740;
  const blockHeight = 380;
  const pagePaddingX = 30;
  const pageStartY = 90;

  const stateStyle =
    'rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#222222;strokeWidth=1.5;arcSize=15;align=center;verticalAlign=middle;fontSize=12;';
  const startStyle =
    'shape=ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#111111;strokeColor=#111111;';
  const finalOuterStyle =
    'shape=ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#FFFFFF;strokeColor=#111111;strokeWidth=2;';
  const finalInnerStyle =
    'shape=ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#111111;strokeColor=#111111;';
  const entityTitleStyle =
    'text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;fontSize=15;fontStyle=1;fontColor=#111111;';
  const edgeStyle =
    'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jetSize=auto;html=1;strokeColor=#1f1f1f;fontColor=#0b8f3a;fontSize=11;endArrow=block;endFill=1;';

  entities.forEach((entity, index) => {
    const blockX = pagePaddingX + (index % 2) * blockWidth;
    const blockY = pageStartY + Math.floor(index / 2) * blockHeight;

    const entityTitleId = nextId();
    cells.push(
      `<mxCell id="${entityTitleId}" value="${esc(entity.name)}" style="${entityTitleStyle}" vertex="1" parent="1"><mxGeometry x="${blockX}" y="${blockY}" width="700" height="24" as="geometry"/></mxCell>`,
    );

    const startNodeId = nextId();
    cells.push(
      `<mxCell id="${startNodeId}" value="" style="${startStyle}" vertex="1" parent="1"><mxGeometry x="${blockX + 8}" y="${blockY + 52}" width="18" height="18" as="geometry"/></mxCell>`,
    );

    const endNodeId = nextId();
    cells.push(
      `<mxCell id="${endNodeId}" value="" style="${finalOuterStyle}" vertex="1" parent="1"><mxGeometry x="${blockX + 6}" y="${blockY + 88}" width="22" height="22" as="geometry"/></mxCell>`,
    );

    const endNodeInnerId = nextId();
    cells.push(
      `<mxCell id="${endNodeInnerId}" value="" style="${finalInnerStyle}" vertex="1" parent="1"><mxGeometry x="${blockX + 11}" y="${blockY + 93}" width="12" height="12" as="geometry"/></mxCell>`,
    );

    const states = [];
    const stateSet = new Set();
    for (const t of entity.transitions) {
      if (t.from !== '*' && t.from !== '[*]' && !stateSet.has(t.from)) {
        stateSet.add(t.from);
        states.push(t.from);
      }
      if (t.to !== '*' && t.to !== '[*]' && !stateSet.has(t.to)) {
        stateSet.add(t.to);
        states.push(t.to);
      }
    }

    const stateIds = {};
    const stateWidth = 152;
    const stateHeight = 44;
    const maxColumns = 3;

    states.forEach((state, stateIndex) => {
      const row = Math.floor(stateIndex / maxColumns);
      const col = stateIndex % maxColumns;
      const x = blockX + 56 + col * 210;
      const y = blockY + 34 + row * 92;
      const stateId = nextId();
      stateIds[state] = stateId;
      cells.push(
        `<mxCell id="${stateId}" value="${esc(state)}" style="${stateStyle}" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${stateWidth}" height="${stateHeight}" as="geometry"/></mxCell>`,
      );
    });

    for (const transition of entity.transitions) {
      const sourceId =
        transition.from === '*' || transition.from === '[*]'
          ? startNodeId
          : transition.from === 'END'
            ? endNodeId
            : stateIds[transition.from];
      const targetId =
        transition.to === '*' || transition.to === '[*]'
          ? endNodeId
          : transition.to === 'END'
            ? endNodeId
            : stateIds[transition.to];

      if (!sourceId || !targetId) {
        continue;
      }

      const edgeId = nextId();
      const label = transition.label || '';
      cells.push(
        `<mxCell id="${edgeId}" value="${esc(label)}" style="${edgeStyle}" edge="1" parent="1" source="${sourceId}" target="${targetId}"><mxGeometry relative="1" as="geometry"/></mxCell>`,
      );
    }

    if (entity.note) {
      const noteId = nextId();
      cells.push(
        `<mxCell id="${noteId}" value="${esc(entity.note)}" style="text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;fontSize=11;fontColor=#666666;" vertex="1" parent="1"><mxGeometry x="${blockX}" y="${blockY + 330}" width="700" height="36" as="geometry"/></mxCell>`,
      );
    }
  });

  return `<diagram name="${esc(name)}" id="${esc(name.toLowerCase().replace(/\s+/g, '-'))}">
    <mxGraphModel dx="2300" dy="3400" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="2200" pageHeight="3400" math="0" shadow="0">
      <root>
        ${cells.join('\n        ')}
      </root>
    </mxGraphModel>
  </diagram>`;
}

const conventionDiagram = buildDiagram(
  'Convention',
  [
    {
      name: 'Sample Pattern (Card Swipe -> Pin Flow)',
      transitions: [
        { from: '*', to: 'waiting_for_pin', label: 'card_swiped' },
        {
          from: 'waiting_for_pin',
          to: 'pin_verification',
          label: 'pin_entered',
        },
        {
          from: 'pin_verification',
          to: 'waiting_for_pin',
          label: 'pin_rejected',
        },
        {
          from: 'pin_verification',
          to: 'user_identified',
          label: 'pin_authentication',
        },
      ],
      note: 'Use rounded state nodes + black start mark + bullseye end mark + green transition labels.',
    },
  ],
  {
    title: 'IntelliServOps State Machine Convention',
    subtitle:
      'Visual standard follows evidence-first convention and sample style from the provided reference image.',
  },
);

const assetDiagram = buildDiagram('Asset Domain', [
  {
    name: 'Apartment',
    transitions: [
      { from: '*', to: 'available', label: 'create' },
      {
        from: '*',
        to: 'inactive',
        label: 'createPartnerCooperationApartment [missing media]',
      },
      {
        from: '*',
        to: 'verified',
        label: 'createPartnerCooperationApartment [has image+video]',
      },
      { from: 'available', to: 'reserved', label: 'reservations.create' },
      { from: 'reserved', to: 'available', label: 'reservations.cancel' },
      {
        from: 'inactive',
        to: 'verified',
        label: 'uploadCooperationMedia [has image+video]',
      },
      { from: 'verified', to: 'pending', label: 'approvePartnerCooperation' },
      {
        from: 'pending',
        to: 'available',
        label: 'partnerSignCooperationContract',
      },
      { from: 'pending', to: 'inactive', label: 'cancel/reject cooperation' },
      { from: 'verified', to: 'inactive', label: 'rejectPartnerCooperation' },
      { from: 'pending', to: 'occupied', label: 'activateWhenDepositPaid' },
      { from: 'available', to: 'maintenance', label: 'updateStatus' },
      { from: 'occupied', to: 'maintenance', label: 'updateStatus' },
      { from: 'maintenance', to: 'END', label: 'end' },
    ],
  },
  {
    name: 'Room',
    transitions: [
      { from: '*', to: 'available', label: 'default' },
      { from: 'available', to: 'END', label: 'end' },
    ],
    note: 'No explicit production transition write observed for occupied/maintenance.',
  },
  {
    name: 'IoTBoard',
    transitions: [
      { from: '*', to: 'active', label: 'createBoard' },
      {
        from: 'active',
        to: 'inactive',
        label: 'removeBoard / updateBoard(status)',
      },
      { from: 'inactive', to: 'active', label: 'updateBoard(status)' },
      { from: 'active', to: 'maintenance', label: 'updateBoard(status)' },
      { from: 'active', to: 'error', label: 'updateBoard(status)' },
      { from: 'maintenance', to: 'END', label: 'end' },
      { from: 'error', to: 'END', label: 'end' },
    ],
  },
  {
    name: 'IoTDevice',
    transitions: [
      { from: '*', to: 'active', label: 'createBoardDevice' },
      {
        from: 'active',
        to: 'inactive',
        label: 'removeDevice / board deactivation',
      },
      { from: 'inactive', to: 'active', label: 'updateBoardDevice(status)' },
      { from: 'active', to: 'maintenance', label: 'updateDevice(status)' },
      { from: 'active', to: 'error', label: 'updateDevice(status)' },
      { from: 'maintenance', to: 'END', label: 'end' },
      { from: 'error', to: 'END', label: 'end' },
    ],
  },
  {
    name: 'UtilityMeter',
    transitions: [
      { from: '*', to: 'active', label: 'createMeter' },
      { from: 'active', to: 'inactive', label: 'updateMeter(status)' },
      { from: 'active', to: 'faulty', label: 'updateMeter(status)' },
      { from: 'inactive', to: 'replaced', label: 'updateMeter(status)' },
      { from: 'faulty', to: 'replaced', label: 'updateMeter(status)' },
      { from: 'replaced', to: 'END', label: 'end' },
    ],
  },
]);

const contractDiagram = buildDiagram('Contract And Membership', [
  {
    name: 'RentalContract',
    transitions: [
      { from: '*', to: 'draft', label: 'create / renewContract' },
      { from: 'draft', to: 'signed', label: 'uploadSignedPdf' },
      { from: 'signed', to: 'active', label: 'activateWhenDepositPaid' },
      { from: 'pending', to: 'active', label: 'activateWhenDepositPaid' },
      { from: 'pending', to: 'expired', label: 'syncExpiredContractsByDate' },
      { from: 'signed', to: 'expired', label: 'syncExpiredContractsByDate' },
      { from: 'active', to: 'expired', label: 'syncExpiredContractsByDate' },
      { from: 'active', to: 'terminated', label: 'cancelByUser' },
      { from: 'expired', to: 'END', label: 'end' },
      { from: 'terminated', to: 'END', label: 'end' },
    ],
  },
  {
    name: 'PartnerCooperationContract',
    transitions: [
      { from: '*', to: 'draft', label: 'schema default' },
      { from: '*', to: 'pending', label: 'approvePartnerCooperation' },
      {
        from: 'pending',
        to: 'signed',
        label: 'partnerSignCooperationContract',
      },
      { from: 'draft', to: 'cancelled', label: 'rejectPartnerCooperation' },
      { from: 'pending', to: 'cancelled', label: 'reject/cancel cooperation' },
      { from: 'signed', to: 'cancelled', label: 'reject/cancel cooperation' },
      { from: 'active', to: 'cancelled', label: 'rejectPartnerCooperation' },
      { from: 'cancelled', to: 'END', label: 'end' },
    ],
  },
  {
    name: 'UserContractMember',
    transitions: [
      { from: '*', to: 'active', label: 'create/addMember' },
      { from: 'active', to: 'moved_out', label: 'cancelByUser' },
      { from: 'moved_out', to: 'END', label: 'end' },
    ],
  },
  {
    name: 'UserApartment',
    transitions: [
      { from: '*', to: 'active', label: 'contract activation upsert' },
      { from: '*', to: 'inactive', label: 'deposit paid before startDate' },
      { from: 'active', to: 'moved_out', label: 'cancelByUser' },
      { from: 'moved_out', to: 'END', label: 'end' },
    ],
  },
]);

const requestDiagram = buildDiagram('Request And Scheduling', [
  {
    name: 'ContactRequest',
    transitions: [
      { from: '*', to: 'new', label: 'default' },
      { from: 'new', to: 'END', label: 'end' },
    ],
    note: 'No explicit status transition write observed in production services.',
  },
  {
    name: 'BookingRequest',
    transitions: [
      { from: '*', to: 'pending', label: 'default' },
      { from: 'pending', to: 'END', label: 'end' },
    ],
    note: 'No explicit status transition write observed in production services.',
  },
  {
    name: 'Reservation',
    transitions: [
      { from: '*', to: 'pending', label: 'reservations.create' },
      { from: 'pending', to: 'confirmed', label: 'uploadSignedPdf' },
      { from: 'pending', to: 'cancelled', label: 'reservations.cancel' },
      { from: 'confirmed', to: 'cancelled', label: 'contracts.cancelByUser' },
      { from: 'cancelled', to: 'END', label: 'end' },
    ],
  },
  {
    name: 'Appointment',
    transitions: [
      { from: '*', to: 'scheduled', label: 'createUserViewingBooking' },
      { from: 'scheduled', to: 'confirmed', label: 'confirmAppointment' },
      { from: 'scheduled', to: 'cancelled', label: 'deny/cancel' },
      { from: 'confirmed', to: 'completed', label: 'confirmDoneJob' },
      { from: 'confirmed', to: 'cancelled', label: 'cancelAppointment' },
      { from: 'completed', to: 'END', label: 'end' },
      { from: 'cancelled', to: 'END', label: 'end' },
    ],
  },
  {
    name: 'PendingGuestRegistration',
    transitions: [
      { from: '*', to: 'pending', label: 'default' },
      { from: 'pending', to: 'END', label: 'end' },
    ],
    note: 'No explicit transition in production services (only backup-file flow exists).',
  },
]);

const operationsDiagram = buildDiagram('Operations Domain', [
  {
    name: 'Task',
    transitions: [
      { from: '*', to: 'pending', label: 'schema default' },
      { from: '*', to: 'assigned', label: 'maintenance.create' },
      { from: 'assigned', to: 'in_progress', label: 'maintenance.accept' },
      { from: 'assigned', to: 'cancelled', label: 'maintenance.reject' },
      { from: 'in_progress', to: 'completed', label: 'maintenance.complete' },
      { from: 'completed', to: 'END', label: 'end' },
      { from: 'cancelled', to: 'END', label: 'end' },
    ],
  },
  {
    name: 'MaintenanceRequest',
    transitions: [
      { from: '*', to: 'submitted', label: 'maintenance.create' },
      { from: 'submitted', to: 'acknowledged', label: 'updateRequest(status)' },
      { from: 'submitted', to: 'scheduled', label: 'updateRequest(status)' },
      { from: 'submitted', to: 'in_progress', label: 'accept' },
      { from: 'acknowledged', to: 'in_progress', label: 'accept' },
      { from: 'scheduled', to: 'in_progress', label: 'accept' },
      { from: 'submitted', to: 'cancelled', label: 'reject' },
      { from: 'acknowledged', to: 'cancelled', label: 'reject' },
      { from: 'scheduled', to: 'cancelled', label: 'reject' },
      { from: 'in_progress', to: 'completed', label: 'complete' },
      { from: 'acknowledged', to: 'completed', label: 'complete' },
      { from: 'scheduled', to: 'completed', label: 'complete' },
      { from: 'completed', to: 'END', label: 'end' },
      { from: 'cancelled', to: 'END', label: 'end' },
    ],
  },
]);

const financeDiagram = buildDiagram('Finance Domain', [
  {
    name: 'Invoice',
    transitions: [
      { from: '*', to: 'draft', label: 'invoices.create' },
      {
        from: '*',
        to: 'issued',
        label: 'contracts.generateMonthlyRentInvoices',
      },
      { from: 'draft', to: 'overdue', label: 'markOverdue' },
      { from: 'issued', to: 'overdue', label: 'markOverdue' },
      { from: 'sent', to: 'overdue', label: 'markOverdue' },
      { from: 'partially_paid', to: 'overdue', label: 'markOverdue' },
      { from: 'draft', to: 'paid', label: 'payments.confirm/webhook' },
      { from: 'issued', to: 'paid', label: 'payments.confirm/webhook' },
      { from: 'issued', to: 'cancelled', label: 'contracts.cancelByUser' },
      { from: 'paid', to: 'END', label: 'end' },
      { from: 'cancelled', to: 'END', label: 'end' },
    ],
  },
  {
    name: 'Payment',
    transitions: [
      { from: '*', to: 'pending', label: 'payments.create' },
      { from: 'pending', to: 'processing', label: 'createPayOSPayment' },
      {
        from: 'processing',
        to: 'pending',
        label: 'createPayOSPayment success',
      },
      { from: 'pending', to: 'completed', label: 'confirm' },
      {
        from: 'processing',
        to: 'completed',
        label: 'handlePayOSWebhook code=00',
      },
      { from: 'pending', to: 'failed', label: 'fail / webhook fail' },
      {
        from: 'processing',
        to: 'failed',
        label: 'webhook fail / create link fail',
      },
      {
        from: 'completed',
        to: 'refunded',
        label: 'refund payout/deposit flow',
      },
      { from: 'failed', to: 'END', label: 'end' },
      { from: 'refunded', to: 'END', label: 'end' },
    ],
  },
  {
    name: 'PartnerMonthlyPayout',
    transitions: [
      { from: '*', to: 'pending', label: 'default' },
      { from: 'pending', to: 'paid', label: 'confirmPartnerMonthlyPayout' },
      { from: 'paid', to: 'END', label: 'end' },
    ],
  },
]);

const platformDiagram = buildDiagram('Platform Domain', [
  {
    name: 'ActivityLog',
    transitions: [
      { from: '*', to: 'success', label: 'createActivityLog default' },
      { from: '*', to: 'failure', label: 'createActivityLog dto.status' },
      { from: '*', to: 'pending', label: 'createActivityLog dto.status' },
      { from: 'success', to: 'END', label: 'end' },
      { from: 'failure', to: 'END', label: 'end' },
      { from: 'pending', to: 'END', label: 'end' },
    ],
  },
  {
    name: 'ChatConversation',
    transitions: [
      { from: '*', to: 'active', label: 'createConversation' },
      { from: 'closed', to: 'active', label: 'createOrReuseConversation' },
      { from: 'active', to: 'archived', label: 'archiveConversation' },
      { from: 'closed', to: 'archived', label: 'archiveConversation' },
      { from: 'archived', to: 'END', label: 'end' },
    ],
    note: 'Sending message to archived conversation is forbidden (no transition).',
  },
]);

const output = `<mxfile host="Electron" agent="draw.io" version="29.5.2">\n${[
  conventionDiagram,
  assetDiagram,
  contractDiagram,
  requestDiagram,
  operationsDiagram,
  financeDiagram,
  platformDiagram,
].join('\n')}\n</mxfile>\n`;

const outPath = path.join(__dirname, 'IntelliServOps_state_machines.drawio');
fs.writeFileSync(outPath, output, 'utf8');
console.log('Generated:', outPath);
