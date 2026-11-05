// Dessins des machines de salle (créés pour Voltra, sans marque ni photo) : on montre à quoi ressemble la machine, pas comment l'utiliser.
// Chaque fiche du catalogue pointe vers un dessin : ajouter une machine revient à l'ajouter dans DESSIN_PAR_FICHE.

const CADRE = "#AEB4BD";
const CADRE_FONCE = "#6F757E";
const COUSSIN = "#30343B";
const BORD = "#555B65";

const Barre = ({ d, w = 5, c = CADRE }) => <path d={d} fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />;
const Coussin = ({ x, y, l, h, a = 0, r = 4 }) => (
  <rect x={x} y={y} width={l} height={h} rx={r} fill={COUSSIN} stroke={BORD} strokeWidth="1.5" transform={a ? `rotate(${a} ${x + l / 2} ${y + h / 2})` : undefined} />
);
const Sol = ({ x1 = 16, x2 = 184 }) => <path d={`M${x1} 128H${x2}`} stroke={CADRE_FONCE} strokeWidth="5" strokeLinecap="round" />;

// Pile de poids avec son câble
const Pile = ({ x, y = 72, l = 26, n = 7, accent }) => (
  <g>
    <rect x={x - 4} y={y - 6} width={l + 8} height={134 - y} rx="3" fill="none" stroke={CADRE_FONCE} strokeWidth="2" />
    {Array.from({ length: n }).map((_, i) => (
      <rect key={i} x={x} y={y + i * 7} width={l} height="5.5" rx="1.5" fill={i === 0 ? accent : "#7D838C"} />
    ))}
  </g>
);
const Poignee = ({ x, y, accent, l = 16 }) => <path d={`M${x - l / 2} ${y}H${x + l / 2}`} stroke={accent} strokeWidth="6" strokeLinecap="round" />;
const Disque = ({ x, y, r = 13, accent }) => (
  <g>
    <circle cx={x} cy={y} r={r} fill="#22252A" stroke={accent} strokeWidth="2.5" />
    <circle cx={x} cy={y} r={r * 0.3} fill={accent} />
  </g>
);

const DESSINS = {
  // Siège, dossier et bras de poussée : chest press, épaules, dips, triceps
  presse_assise: ({ a, dossier = -12, poigneeY = 62 }) => (
    <>
      <Sol />
      <Barre d="M118 128V24H168V128" />
      <Barre d="M72 128V94" />
      <Barre d="M72 106H118" />
      <Coussin x={52} y={88} l={44} h={10} />
      <Coussin x={84} y={38} l={11} h={52} a={dossier} />
      <Barre d={`M118 40L92 40L46 ${poigneeY}`} w={5} />
      <Poignee x={42} y={poigneeY} accent={a} l={14} />
      <Pile x={130} accent={a} />
    </>
  ),
  // Chest press inclinée : dossier très couché, bras qui montent
  presse_inclinee: ({ a }) => (
    <>
      <Sol />
      <Barre d="M124 128V20H172V128" />
      <Barre d="M58 128V100H124" />
      <Coussin x={36} y={92} l={40} h={10} />
      <Coussin x={70} y={46} l={11} h={54} a={32} />
      <Barre d="M124 34H98L44 34" />
      <Poignee x={42} y={34} accent={a} l={14} />
      <Pile x={136} accent={a} />
    </>
  ),
  // Pec deck : dossier droit et bras qui se referment
  pec_deck: ({ a }) => (
    <>
      <Sol />
      <Barre d="M118 128V22H168V128" />
      <Barre d="M72 128V96H118" />
      <Coussin x={50} y={90} l={42} h={10} />
      <Coussin x={84} y={36} l={11} h={56} />
      <Barre d="M118 32H78" />
      <Barre d="M78 32Q56 34 48 56" w={6} />
      <Coussin x={36} y={54} l={12} h={30} r={5} />
      <circle cx="78" cy="32" r="5" fill={a} />
      <Pile x={130} accent={a} />
    </>
  ),
  // Tour de tirage : poulie haute, barre large, siège et cale-cuisses
  tirage_vertical: ({ a }) => (
    <>
      <Sol />
      <Barre d="M150 128V14H66" />
      <Barre d="M150 128H176" />
      <circle cx="68" cy="16" r="5" fill="none" stroke={CADRE} strokeWidth="3" />
      <path d="M68 20V44" stroke={CADRE} strokeWidth="2" />
      <path d="M38 48Q68 38 98 48" fill="none" stroke={a} strokeWidth="6" strokeLinecap="round" />
      <Barre d="M92 128V100H150" />
      <Coussin x={72} y={94} l={38} h={10} />
      <Barre d="M108 94V72" w={4} />
      <Coussin x={84} y={64} l={32} h={9} r={4.5} />
      <Pile x={156} y={68} l={22} accent={a} />
    </>
  ),
  // Tour de tractions assistées : poignées hautes et plateforme
  traction_assistee: ({ a }) => (
    <>
      <Sol />
      <Barre d="M136 128V18H74" />
      <Barre d="M74 18V34" w={4} />
      <Poignee x={68} y={36} accent={a} l={24} />
      <Barre d="M136 58H90" w={4} />
      <Poignee x={84} y={58} accent={a} l={18} />
      <Barre d="M136 104H88" />
      <Coussin x={56} y={94} l={40} h={9} />
      <Barre d="M76 103V128" w={4} />
      <Pile x={144} y={68} l={24} accent={a} />
    </>
  ),
  // Rowing assis : plastron, siège et poignées
  rowing: ({ a }) => (
    <>
      <Sol />
      <Barre d="M138 128V30H176V128" />
      <Barre d="M46 128V100H138" />
      <Coussin x={26} y={94} l={40} h={10} />
      <Barre d="M84 100V68" w={4} />
      <Coussin x={78} y={42} l={11} h={30} r={5} />
      <Barre d="M138 50H104L94 66" />
      <Poignee x={92} y={68} accent={a} l={14} />
      <Pile x={147} y={66} l={22} n={8} accent={a} />
    </>
  ),
  // T-bar : barre pivotante au sol, plateforme et disques
  t_bar: ({ a }) => (
    <>
      <Sol />
      <Barre d="M28 128L36 116" />
      <circle cx="36" cy="116" r="5" fill={CADRE} />
      <Barre d="M36 116L140 60" w={5} />
      <Disque x={146} y={56} r={19} accent={a} />
      <Barre d="M106 80L92 52" w={4} />
      <Poignee x={90} y={50} accent={a} l={22} />
      <Coussin x={84} y={118} l={44} h={7} r={3} />
    </>
  ),
  // Élévations latérales : bras en L
  elevation_laterale: ({ a }) => (
    <>
      <Sol />
      <Barre d="M116 128V30H166V128" />
      <Barre d="M72 128V96H116" />
      <Coussin x={52} y={90} l={42} h={10} />
      <Coussin x={84} y={46} l={11} h={46} />
      <Barre d="M116 42H62" />
      <circle cx="116" cy="42" r="5" fill={a} />
      <Coussin x={46} y={36} l={22} h={13} r={6} />
      <Pile x={128} accent={a} />
    </>
  ),
  // Curl : pupitre, siège et bras de levier
  curl: ({ a }) => (
    <>
      <Sol />
      <Barre d="M128 128V34H172V128" />
      <Barre d="M56 128V100" />
      <Coussin x={34} y={94} l={44} h={10} />
      <Barre d="M56 112H128" />
      <Barre d="M102 112V76" w={4} />
      <Coussin x={78} y={68} l={36} h={9} a={-18} r={4.5} />
      <Barre d="M128 48H106L74 44" />
      <Poignee x={70} y={44} accent={a} l={16} />
      <Pile x={138} accent={a} />
    </>
  ),
  // Presse à cuisses 45° : chariot sur rail, plateau et disques
  leg_press: ({ a }) => (
    <>
      <Sol />
      <Barre d="M28 122L160 34" w={7} c={CADRE_FONCE} />
      <Barre d="M28 128V120M160 128V36" />
      <Barre d="M160 128H96" w={4} />
      <Coussin x={26} y={92} l={46} h={11} a={-34} />
      <Coussin x={20} y={72} l={11} h={34} a={-34} />
      <Coussin x={112} y={36} l={10} h={40} a={-34} r={3} />
      <Disque x={138} y={46} r={16} accent={a} />
    </>
  ),
  // Hack squat : glissière inclinée, dossier et épaulières
  hack_squat: ({ a }) => (
    <>
      <Sol />
      <Barre d="M36 128L142 28" w={7} c={CADRE_FONCE} />
      <Barre d="M142 128V28" />
      <Barre d="M36 128H142" w={4} />
      <Coussin x={68} y={62} l={54} h={11} a={-43} />
      <Coussin x={108} y={30} l={22} h={10} a={-43} r={5} />
      <Disque x={150} y={62} r={15} accent={a} />
      <Coussin x={26} y={118} l={40} h={7} r={3} />
    </>
  ),
  // Smith machine : barre guidée sur deux rails
  smith: ({ a }) => (
    <>
      <Sol />
      <Barre d="M48 128V14M152 128V14" w={6} />
      <Barre d="M42 14H158" w={6} />
      <Barre d="M28 66H172" w={5} />
      <Disque x={34} y={66} r={15} accent={a} />
      <Disque x={166} y={66} r={15} accent={a} />
      <rect x="43" y="59" width="10" height="14" rx="2" fill={a} />
      <rect x="147" y="59" width="10" height="14" rx="2" fill={a} />
      <Coussin x={70} y={108} l={60} h={9} />
      <Barre d="M84 117V128M116 117V128" w={4} />
    </>
  ),
  // Leg extension : siège, dossier et boudin aux chevilles
  leg_extension: ({ a }) => (
    <>
      <Sol />
      <Barre d="M116 128V40H164V128" />
      <Barre d="M58 128V100H116" />
      <Coussin x={46} y={90} l={46} h={11} />
      <Coussin x={84} y={46} l={11} h={46} a={-8} />
      <Barre d="M50 96L34 118" w={5} />
      <circle cx="50" cy="96" r="5" fill={a} />
      <Coussin x={22} y={112} l={24} h={11} r={5.5} />
      <Pile x={126} y={70} accent={a} />
    </>
  ),
  // Leg curl assis : boudin haut qui descend sous les jambes
  leg_curl_assis: ({ a }) => (
    <>
      <Sol />
      <Barre d="M118 128V38H166V128" />
      <Barre d="M62 128V100H118" />
      <Coussin x={50} y={90} l={46} h={11} />
      <Coussin x={86} y={44} l={11} h={48} a={-10} />
      <Coussin x={44} y={70} l={40} h={9} r={4.5} />
      <Barre d="M52 96L26 82" w={5} />
      <circle cx="52" cy="96" r="5" fill={a} />
      <Coussin x={14} y={74} l={22} h={11} r={5.5} />
      <Pile x={128} y={70} accent={a} />
    </>
  ),
  // Leg curl allongé : banc coudé et boudin
  leg_curl_allonge: ({ a }) => (
    <>
      <Sol />
      <Barre d="M136 128V36H178V128" />
      <Barre d="M54 128V92M112 128V92" />
      <Coussin x={26} y={80} l={58} h={11} a={-6} />
      <Coussin x={82} y={82} l={44} h={11} a={6} />
      <Barre d="M36 88L18 62" w={5} />
      <circle cx="36" cy="88" r="5" fill={a} />
      <Coussin x={8} y={54} l={22} h={11} r={5.5} />
      <Pile x={146} y={66} l={22} n={8} accent={a} />
    </>
  ),
  // Leg curl debout : appui genou et boudin
  leg_curl_debout: ({ a }) => (
    <>
      <Sol />
      <Barre d="M120 128V30H168V128" />
      <Barre d="M72 128V112H120" />
      <Coussin x={56} y={104} l={34} h={8} />
      <Barre d="M92 112V44" w={4} />
      <Coussin x={68} y={38} l={38} h={9} r={4.5} />
      <Coussin x={76} y={74} l={18} h={14} r={6} />
      <Barre d="M92 86L58 92" w={5} />
      <Coussin x={46} y={86} l={20} h={11} r={5.5} />
      <Pile x={130} y={66} accent={a} n={8} />
    </>
  ),
  // Hip thrust : dossier, sangle ou boudin sur les hanches
  hip_thrust: ({ a }) => (
    <>
      <Sol />
      <Barre d="M30 128V88H66" />
      <Coussin x={16} y={74} l={52} h={12} a={-16} />
      <Barre d="M70 128V100H160V128" />
      <Barre d="M72 100L108 68" />
      <circle cx="72" cy="100" r="5" fill={a} />
      <Coussin x={94} y={58} l={38} h={12} r={6} />
      <Coussin x={126} y={118} l={46} h={7} r={3} />
      <Disque x={94} y={92} r={14} accent={a} />
    </>
  ),
  // Kickback : appui avant-bras et plateau de poussée
  kickback: ({ a }) => (
    <>
      <Sol />
      <Barre d="M138 128V34H176V128" />
      <Barre d="M62 128V94H138" />
      <Coussin x={46} y={84} l={52} h={10} />
      <Barre d="M78 84V52" w={4} />
      <Coussin x={60} y={44} l={36} h={9} r={4.5} />
      <Barre d="M116 94L126 112" w={5} />
      <circle cx="116" cy="94" r="5" fill={a} />
      <Coussin x={112} y={110} l={26} h={8} r={3} />
      <Pile x={147} y={66} l={22} n={8} accent={a} />
    </>
  ),
  // Abducteurs et adducteurs, vue de face : siège et deux bras
  hanches: ({ a }) => (
    <>
      <Sol />
      <Barre d="M100 128V94" />
      <Barre d="M72 128H128" />
      <Coussin x={78} y={84} l={44} h={11} />
      <Coussin x={82} y={30} l={36} h={52} r={6} />
      <Barre d="M86 92L54 76" />
      <Barre d="M114 92L146 76" />
      <circle cx="86" cy="92" r="5" fill={a} />
      <circle cx="114" cy="92" r="5" fill={a} />
      <Coussin x={42} y={58} l={13} h={32} r={6} />
      <Coussin x={145} y={58} l={13} h={32} r={6} />
    </>
  ),
  // Mollets assis : siège, boudin sur les cuisses et cale-pieds
  mollets_assis: ({ a }) => (
    <>
      <Sol />
      <Barre d="M136 128V70" />
      <Barre d="M40 128H136" w={5} />
      <Coussin x={108} y={82} l={44} h={11} />
      <Barre d="M136 104H72L64 76" />
      <Coussin x={50} y={66} l={40} h={11} r={5.5} />
      <Disque x={60} y={100} r={14} accent={a} />
      <Coussin x={46} y={118} l={38} h={7} r={3} />
    </>
  ),
  // Mollets debout : épaulières et cale-pieds
  mollets_debout: ({ a }) => (
    <>
      <Sol />
      <Barre d="M124 128V24H170V128" />
      <Barre d="M124 44H64" />
      <Coussin x={48} y={44} l={36} h={11} r={5.5} />
      <Barre d="M124 112H64" />
      <Coussin x={46} y={108} l={40} h={8} r={3} />
      <Pile x={134} y={66} l={24} n={8} accent={a} />
    </>
  ),
  // Crunch : siège et poignées au-dessus des épaules
  crunch: ({ a }) => (
    <>
      <Sol />
      <Barre d="M124 128V34H170V128" />
      <Barre d="M62 128V100H124" />
      <Coussin x={44} y={92} l={46} h={11} />
      <Coussin x={84} y={46} l={11} h={46} a={-10} />
      <Barre d="M124 44H72L58 64" />
      <circle cx="96" cy="44" r="5" fill={a} />
      <Poignee x={54} y={66} accent={a} l={14} />
      <Pile x={134} y={68} l={24} accent={a} />
    </>
  ),
  // Rotation du buste, vue de face
  rotation: ({ a }) => (
    <>
      <Sol />
      <Barre d="M100 128V98" />
      <Barre d="M70 128H130" />
      <ellipse cx="100" cy="92" rx="30" ry="7" fill={COUSSIN} stroke={BORD} strokeWidth="1.5" />
      <Coussin x={84} y={34} l={32} h={52} r={6} />
      <path d="M58 56Q100 74 142 56" fill="none" stroke={CADRE} strokeWidth="5" strokeLinecap="round" />
      <Poignee x={54} y={54} accent={a} l={12} />
      <Poignee x={146} y={54} accent={a} l={12} />
    </>
  ),
  // Banc à lombaires : plateau incliné et cale-pieds
  lombaires: ({ a }) => (
    <>
      <Sol />
      <Barre d="M40 128L150 56" w={6} />
      <Barre d="M150 128V58" />
      <Barre d="M40 128H150" w={4} />
      <Coussin x={84} y={72} l={44} h={11} a={-33} />
      <Coussin x={26} y={100} l={24} h={11} a={-33} r={5.5} />
      <circle cx="46" cy="112" r="4.5" fill={a} />
    </>
  ),
  // Glute ham : plateau arrondi et cale-chevilles
  ghd: ({ a }) => (
    <>
      <Sol />
      <Barre d="M36 128V96H160V128" />
      <path d="M72 86Q100 66 128 86Z" fill={COUSSIN} stroke={BORD} strokeWidth="1.5" />
      <Barre d="M100 96V82" w={4} />
      <Barre d="M36 96V70" w={4} />
      <Coussin x={20} y={60} l={32} h={10} r={5} />
      <circle cx="36" cy="96" r="5" fill={a} />
    </>
  ),
  // Chaise romaine : dossier et appuis avant-bras
  chaise_romaine: ({ a }) => (
    <>
      <Sol />
      <Barre d="M120 128V22" w={6} />
      <Barre d="M84 128H150" w={5} />
      <Coussin x={108} y={36} l={12} h={58} />
      <Barre d="M120 54H68" />
      <Coussin x={62} y={44} l={46} h={9} r={4.5} />
      <Poignee x={60} y={48} accent={a} l={12} />
      <Barre d="M120 22H78" w={5} />
      <Poignee x={72} y={22} accent={a} l={18} />
    </>
  ),
  // Station de poulies : colonne, câble et poignée réglable
  poulie: ({ a }) => (
    <>
      <Sol />
      <Barre d="M88 128V14H132V128" w={6} />
      <Barre d="M76 128H144" w={5} />
      <Barre d="M88 44H66" w={4} />
      <circle cx="62" cy="44" r="6" fill="none" stroke={CADRE} strokeWidth="3" />
      <path d="M58 48L40 80" stroke={CADRE} strokeWidth="2" />
      <Poignee x={38} y={84} accent={a} l={18} />
      <Pile x={97} y={30} l={26} n={13} accent={a} />
    </>
  ),
  sled: ({ a }) => (
    <>
      <Sol x1={8} x2={192} />
      <Barre d="M46 120H150" w={7} />
      <Barre d="M46 120L36 128M150 120L160 128" />
      <Barre d="M66 120V38M120 120V38" w={6} />
      <Poignee x={58} y={38} accent={a} l={22} />
      <Poignee x={128} y={38} accent={a} l={22} />
      <Disque x={93} y={98} r={20} accent={a} />
    </>
  ),
  cordes: ({ a }) => (
    <>
      <Sol x1={8} x2={192} />
      <Barre d="M176 128V100" w={8} />
      <path d="M172 104C148 76 132 128 108 96S72 70 44 92" fill="none" stroke={a} strokeWidth="5" strokeLinecap="round" />
      <path d="M172 112C148 92 132 132 108 108S72 88 44 106" fill="none" stroke={CADRE} strokeWidth="5" strokeLinecap="round" />
    </>
  ),
  rameur: ({ a }) => (
    <>
      <Sol x1={8} x2={192} />
      <Barre d="M26 118H148" w={7} c={CADRE_FONCE} />
      <circle cx="160" cy="98" r="27" fill="#22252A" stroke={CADRE} strokeWidth="5" />
      <circle cx="160" cy="98" r="8" fill={a} />
      <Coussin x={60} y={102} l={32} h={10} />
      <Barre d="M136 72L106 80" w={3} />
      <Poignee x={104} y={80} accent={a} l={18} />
      <Coussin x={118} y={100} l={8} h={18} r={2} />
    </>
  ),
  air_bike: ({ a }) => (
    <>
      <Sol x1={8} x2={192} />
      <circle cx="136" cy="94" r="32" fill="#22252A" stroke={CADRE} strokeWidth="5" />
      <path d="M136 62V126M104 94H168M113 71L159 117M159 71L113 117" stroke={CADRE_FONCE} strokeWidth="2" />
      <Barre d="M136 94L74 62" w={6} />
      <Coussin x={56} y={52} l={36} h={9} r={4.5} />
      <Barre d="M136 94L54 128M100 128H168" w={5} />
      <Barre d="M118 74L110 24" w={5} />
      <Poignee x={108} y={22} accent={a} l={22} />
    </>
  ),
  ski_erg: ({ a }) => (
    <>
      <Sol x1={8} x2={192} />
      <Barre d="M104 128V16H150V128" w={6} />
      <Barre d="M72 128H172" w={6} />
      <circle cx="127" cy="44" r="19" fill="#22252A" stroke={CADRE} strokeWidth="4" />
      <circle cx="127" cy="44" r="6" fill={a} />
      <path d="M106 40L72 62M106 48L60 74" stroke={CADRE} strokeWidth="2" />
      <Poignee x={68} y={64} accent={a} l={14} />
      <Poignee x={56} y={76} accent={a} l={14} />
    </>
  ),
  mur: ({ a }) => (
    <>
      <Sol x1={8} x2={192} />
      <rect x="150" y="10" width="22" height="118" rx="3" fill="#22252A" stroke={CADRE_FONCE} strokeWidth="3" />
      <circle cx="160" cy="28" r="9" fill="none" stroke={a} strokeWidth="3" />
      <circle cx="70" cy="104" r="23" fill="#22252A" stroke={a} strokeWidth="4" />
      <path d="M47 104H93M70 81V127" stroke={CADRE_FONCE} strokeWidth="2" />
    </>
  ),
  landmine: ({ a }) => (
    <>
      <Sol x1={8} x2={192} />
      <rect x="20" y="118" width="26" height="10" rx="2" fill={CADRE_FONCE} />
      <circle cx="33" cy="116" r="6" fill={CADRE} />
      <Barre d="M33 116L150 44" w={6} />
      <Disque x={156} y={40} r={20} accent={a} />
    </>
  ),
};

// Quelle machine dessiner pour chaque fiche du catalogue
const DESSIN_PAR_FICHE = {
  chest_press: ["presse_assise"],
  chest_press_inclinee: ["presse_inclinee"],
  chest_press_declinee: ["presse_assise", { poigneeY: 78, dossier: -22 }],
  pec_deck: ["pec_deck"],
  reverse_pec_deck: ["pec_deck"],
  smith_developpe: ["smith"], smith_militaire: ["smith"], smith_squat: ["smith"], smith_hip_thrust: ["smith"],
  lat_pulldown: ["tirage_vertical"],
  traction_assistee: ["traction_assistee"], dip_assiste: ["traction_assistee"],
  rowing_assis: ["rowing"], rowing_haut: ["rowing"], rowing_poitrine: ["rowing"],
  rowing_t_bar: ["t_bar"],
  banc_lombaires: ["lombaires"],
  shoulder_press: ["presse_assise", { poigneeY: 34, dossier: -4 }],
  elevation_laterale_machine: ["elevation_laterale"],
  curl_machine: ["curl"], curl_pupitre: ["curl"],
  triceps_machine: ["presse_assise", { poigneeY: 84, dossier: -4 }],
  extension_triceps_machine: ["presse_assise", { poigneeY: 48, dossier: -4 }],
  leg_press: ["leg_press"], mollets_presse: ["leg_press"],
  hack_squat: ["hack_squat"], pendulum_squat: ["hack_squat"], belt_squat: ["hack_squat"],
  leg_extension: ["leg_extension"],
  leg_curl_assis: ["leg_curl_assis"], leg_curl_allonge: ["leg_curl_allonge"], leg_curl_debout: ["leg_curl_debout"],
  ghd: ["ghd"],
  hip_thrust_machine: ["hip_thrust"],
  kickback_machine: ["kickback"], multi_hip: ["kickback"],
  abducteur_machine: ["hanches"], adducteur_machine: ["hanches"],
  mollets_assis: ["mollets_assis"], mollets_debout: ["mollets_debout"],
  crunch_machine: ["crunch"], rotary_torso: ["rotation"],
  releve_jambes: ["chaise_romaine"],
  sled_push: ["sled"], battle_ropes: ["cordes"], rameur: ["rameur"], air_bike: ["air_bike"], ski_erg: ["ski_erg"], wall_ball: ["mur"], landmine_press: ["landmine"],
};

export const aUneIllustration = (f) => !!f && (f.type === "poulie" || !!DESSIN_PAR_FICHE[f.id]);

export function IllustrationMachine({ fiche, accent = "#9BE84F" }) {
  const [nom, reglages] = fiche?.type === "poulie" ? ["poulie"] : DESSIN_PAR_FICHE[fiche?.id] || [];
  const Dessin = DESSINS[nom];
  if (!Dessin) return null;
  return (
    <svg viewBox="0 0 200 140" width="100%" height="100%" role="img" aria-label={fiche.fr} style={{ display: "block" }}>
      <Dessin a={accent} {...reglages} />
    </svg>
  );
}

export const DESSINS_NOMS = DESSIN_PAR_FICHE;
