// CodeLooter — Language detection
// Detects the dominant programming language of a code block.
// Ported from CodeLooter backend/app/pattern_detect.py with refinements.
//
// Supports 15 languages: R, Python, SQL, Java, C++, JavaScript, TypeScript,
// PHP, Bash, Go, Rust, Kotlin, HTML, CSS, JSON, MATLAB.

// R-specific signals — derived from analysis of Indonesian statistics modules.
export const R_SIGNALS: RegExp[] = [
  /<-/,
  /\blibrary\s*\(/,
  /\brequire\s*\(/,
  /\bcat\s*\(/,
  /\bqt\s*\(/,
  /\bqnorm\s*\(/,
  /\bqf\s*\(/,
  /\bqchisq\s*\(/,
  /\bpt\s*\(/,
  /\bpnorm\s*\(/,
  /\bpf\s*\(/,
  /\bdnorm\s*\(/,
  /\bdchisq\s*\(/,
  /\bdt\s*\(/,
  /\bsummary\s*\(/,
  /\blm\s*\(/,
  /\bglm\s*\(/,
  /\baov\s*\(/,
  /\bcor\.test\s*\(/,
  /\bchisq\.test\s*\(/,
  /\bt\.test\s*\(/,
  /\bwilcox\.test\s*\(/,
  /\bmann\.whitney\s*\(/,
  /\bkruskal\.test\s*\(/,
  /\bshapiro\.test\s*\(/,
  /\bdata\.frame\s*\(/,
  /\bread\.csv\s*\(/,
  /\bread\.table\s*\(/,
  /\bread\.xlsx\s*\(/,
  /\bread\.delim\s*\(/,
  /\bset\.seed\s*\(/,
  /\bsample\s*\(/,
  /\bggplot\s*\(/,
  /\baes\s*\(/,
  /\bgeom_\w+\s*\(/,
  /\bfacet_\w+\s*\(/,
  /\btheme_\w+\s*\(/,
  /\bqqnorm\s*\(/,
  /\bqqline\s*\(/,
  /\bpar\s*\(/,
  /\bplot\s*\(/,
  /\babline\s*\(/,
  /\bhist\s*\(/,
  /\bboxplot\s*\(/,
  /\bpredict\s*\(/,
  /\bconfint\s*\(/,
  /\bresiduals\s*\(/,
  /%>%/,
  /%[+\*]%/,
  /\b\w+\$\w+/, // data$column
  /\bprint\s*\(/,
  /\bmean\s*\(/,
  /\bmedian\s*\(/,
  /\bsd\s*\(/,
  /\bvar\s*\(/,
  /\bsqrt\s*\(/,
  /\babs\s*\(/,
  /\bround\s*\(/,
  /\bfloor\s*\(/,
  /\bceiling\s*\(/,
  /\bcbind\s*\(/,
  /\brbind\s*\(/,
  /\bhead\s*\(/,
  /\btail\s*\(/,
  /\bstr\s*\(/,
  /\bglimpse\s*\(/,
  /\bseq\s*\(/,
  /\brep\s*\(/,
  /\bc\s*\(/,
  /\bas\.matrix\s*\(/,
  /\bas\.data\.frame\s*\(/,
  /\bas\.numeric\s*\(/,
  /\bas\.character\s*\(/,
  /\btextConnection\s*\(/,
  /\bwrite\.csv\s*\(/,
  /\bwrite\.table\s*\(/,
  /\btable\s*\(/,
  /\bprop\.table\s*\(/,
  /\bmargin\.table\s*\(/,
  /\baddmargins\s*\(/,
  /\bfactor\s*\(/,
  /\blevels\s*\(/,
  /\bnames\s*\(/,
  /\bcolnames\s*\(/,
  /\brownames\s*\(/,
  /\bnrow\s*\(/,
  /\bncol\s*\(/,
  /\bdim\s*\(/,
  /\blength\s*\(/,
  /\bsort\s*\(/,
  /\border\s*\(/,
  /\bunique\s*\(/,
  /\bduplicated\s*\(/,
  /\bsubset\s*\(/,
  /\bfilter\s*\(/,
  /\bmutate\s*\(/,
  /\bselect\s*\(/,
  /\bgroup_by\s*\(/,
  /\bsummarise\s*\(/,
  /\bsummarize\s*\(/,
  /\barrange\s*\(/,
  /\bpaste\s*\(/,
  /\bpaste0\s*\(/,
  /\bsprintf\s*\(/,
  /\bnchar\s*\(/,
  /\btolower\s*\(/,
  /\btoupper\s*\(/,
  /\bsubstr\s*\(/,
  /\bgsub\s*\(/,
];

const PYTHON_SIGNALS: RegExp[] = [
  /\bdef\s+\w+\s*\(/,
  /\bimport\s+\w+/,
  /\bfrom\s+\w+\s+import/,
  /\bprint\s*\(/,
  /\bif\s+__name__/,
  /\bself\b/,
  /\bnp\./,
  /\bpd\./,
  /\bplt\./,
  /\bsns\./,
  /\belif\s+/,
  /\bexcept\s+\w+/,
  /\braise\s+\w+/,
  /\byield\s/,
  /\blambda\s+/,
  /\basync\s+def\s/,
  /\bawait\s+/,
  /\bf["'].*\{.*\}.*["']/,  // f-string
  /\bclass\s+\w+.*:/,
  /\b__init__\s*\(/,
  /\b__name__/,
  /\b__main__/,
  // Python-specific list methods (not Go's append)
  /\.\bappend\s*\(/,
  /\.\bextend\s*\(/,
  /\.\bsort\s*\(/,
  /\.\breverse\s*\(/,
  /\.\bpop\s*\(/,
  /\.\binsert\s*\(/,
  /\.\bremove\s*\(/,
];

const SQL_SIGNALS: RegExp[] = [
  /\bSELECT\b/i,
  /\bFROM\b/i,
  /\bWHERE\b/i,
  /\bJOIN\b/i,
  /\bINSERT\s+INTO\b/i,
  /\bCREATE\s+TABLE\b/i,
  /\bUPDATE\s+\w+\s+SET\b/i,
  /\bDELETE\s+FROM\b/i,
  /\bGROUP\s+BY\b/i,
  /\bORDER\s+BY\b/i,
  /\bHAVING\b/i,
  /\bPRIMARY\s+KEY\b/i,
  /\bFOREIGN\s+KEY\b/i,
  /\bAUTO_INCREMENT\b/i,
  /\bVARCHAR\b/i,
  /\bDECIMAL\b/i,
  /\bINNER\s+JOIN\b/i,
  /\bLEFT\s+JOIN\b/i,
];

// ── NEW: Comprehensive language signals for 15 languages ──

const JAVA_SIGNALS: RegExp[] = [
  /\bpublic\s+class\s+\w+/,
  /\bprivate\s+(static\s+)?\w+\s+\w+\s*[=;]/,
  /\bprotected\s+\w+\s+\w+/,
  /\bpublic\s+(static\s+)?(void|int|String|double|boolean|long|float|char)\s+\w+\s*\(/,
  /\bvoid\s+\w+\s*\(/,
  /\bSystem\.(out|err)\./,
  /\bimport\s+java\./,
  /\bnew\s+\w+\s*\(/,
  /\bthis\.\w+/,
  /\b@\w+(?:\.\w+)*\s*\n?\s*(?:public|private|protected|static)/,
  /\bextends\s+\w+/,
  /\bimplements\s+\w+/,
  /\breturn\s+(new\s+)?\w+/,
  /\bnull\b/,
  /\btrue\b/,
  /\bfalse\b/,
  /\binstanceof\s+\w+/,
  /\bthrows\s+\w+/,
];

const CPP_SIGNALS: RegExp[] = [
  /#include\s+[<"]/,
  /#define\s+\w+/,
  /#ifndef\s+\w+/,
  /#pragma\s+(once|hdrstop)/,
  /\busing\s+namespace\s+/,
  /\btemplate\s*<[^>]*>/,
  /\bstd::\w+/,
  /\bcout\s*<</,
  /\bcin\s*>>/,
  /\bcerr\s*<</,
  /\bint\s+main\s*\(/,
  /\bendl\b/,
  /\bnullptr\b/,
  /\bnew\s+\w+\s*\[/,
  /\bdelete\s+\w+/,
  /\b::\w+/,
  /\b->\w+/,
  /\bconst\s+\w+\s*&/,
  /\bunsigned\s+(int|long|short)/,
  /\bsize_t\b/,
  /\bauto\s+\w+\s*=/,
  /\blambda\s+/,
  /\bnamespace\s+\w+/,
];

const JAVASCRIPT_SIGNALS: RegExp[] = [
  /\bconst\s+\w+\s*=/,
  /\blet\s+\w+\s*=/,
  /\bvar\s+\w+\s*=/,
  /\bfunction\s+\w+\s*\(/,
  /\b=>\s*[{(]/,
  /\bconsole\.(log|error|warn|info)\s*\(/,
  /\bdocument\.\w+/,
  /\bwindow\.\w+/,
  /\brequire\s*\(\s*['"]/,
  /\bmodule\.exports\b/,
  /\bexport\s+(default\s+)?(const|function|class)\s+/,
  /\bimport\s+.*from\s+['"]/,
  /\basync\s+function\s+/,
  /\bawait\s+/,
  /\btypeof\s+\w+/,
  /\binstanceof\s+\w+/,
  /\bnew\s+\w+\s*\(/,
  /\bJSON\.(parse|stringify)\s*\(/,
  /\bArray\.\w+\s*\(/,
  /\bObject\.\w+\s*\(/,
  /\bPromise\s*\(/,
  /\bthrow\s+new\s+\w+/,
];

const TYPESCRIPT_SIGNALS: RegExp[] = [
  /\binterface\s+\w+\s*\{/,
  /\btype\s+\w+\s*=/,
  /\bexport\s+(default\s+)?(const|function|class|interface|type|enum)\s+/,
  /\b:\s*\w+<[^>]*>/,  // generic type annotation
  /\bas\s+\w+\b/,
  /\breadonly\s+\w+/,
  /\bnamespace\s+\w+/,
  /\bimport\s+.*from\s+['"]/,
  /\babstract\s+class\s+/,
  /\bimplements\s+\w+/,
  /\bextends\s+\w+/,
  /\bprivate\s+\w+\s*:/,
  /\bpublic\s+\w+\s*:/,
  /\bprotected\s+\w+\s*:/,
  /\b@decorator\b/,
  ...JAVASCRIPT_SIGNALS,  // TS is a superset of JS
];

const PHP_SIGNALS: RegExp[] = [
  /<\?php/,
  /<\?=/,
  /\?\>/,
  /\$\w+\s*=/,
  /\$\w+\s*->\s*\w+/,
  /\bfunction\s+\w+\s*\([^)]*\)\s*\{/,
  /\barray\s*\(/,
  /\bforeach\s*\(/,
  /\becho\s+/,
  /\bnew\s+\w+\s*\(/,
  /\b$this->\w+/,
  /\b::\w+\(/,
  /\b__construct\s*\(/,
  /\bpublic\s+(static\s+)?function\s+/,
  /\bprivate\s+(static\s+)?function\s+/,
  /\bprotected\s+(static\s+)?function\s+/,
  /\bclass\s+\w+\s*(?:extends|implements)\s+/,
  /\bnamespace\s+\w+/,
  /\buse\s+\\?\w+(?:\\+\w+)*/,
  /\bPDO::\w+/,
  /\bjson_encode\s*\(/,
  /\bjson_decode\s*\(/,
  /\bheader\s*\(\s*['"]/,
  // NOTE: print() removed — too common across languages (Python, R, PHP, JS).
  // PHP detection now relies on <?php tag, $variables, ->, ::, etc.
];

const BASH_SIGNALS: RegExp[] = [
  /^#!\/(bin|usr)\/(bash|sh|zsh)/,
  /\bset\s+-[eu]/,
  /\becho\s+["-]/,
  /\bif\s*\[\s/,
  /\bfi\b/,
  /\bfor\s+\w+\s+in\s+/,
  /\bdone\b/,
  /\bwhile\s+\[/,
  /\bwhile\s+read\s+/,
  /\bcase\s+.*\s+in/,
  /\besac\b/,
  /\bexport\s+\w+=/,
  /\blocal\s+\w+=/,
  /\breadonly\s+\w+/,
  /\$\{\w+\}/,
  /\$\(\([^)]+\)\)/,  // arithmetic expansion
  /\$\([^)]+\)/,  // command substitution
  /\bthen\b/,
  /\bdo\b/,
  /\belif\b/,
  /\belse\b/,
  /\bcd\s+\w/,
  /\btar\s+-[czx]/,
  /\bgit\s+(pull|push|clone|commit|add|checkout|branch|merge)/,
  /\bnpm\s+(install|run|ci|test|build|start)/,
  /\bsystemctl\s+(start|stop|restart|status|enable|disable)/,
  /\bapt(?:-get)?\s+(install|update|upgrade|remove)/,
  /\byum\s+(install|update|remove)/,
  /\bdocker\s+(run|build|pull|push|compose)/,
  /\bmkdir\s+-p\s/,
  /\brm\s+-rf\s/,
  /\bcp\s+-r\s/,
  /\bmv\s+\w+\s+\w+/,
  /\bchmod\s+\d+\s/,
  /\bchown\s+\w+:\w+\s/,
  /\bgrep\s+-[rRn]/,
  /\bsed\s+-[i]/,
  /\bawk\s+['{]/,
  /\bwc\s+-[lwc]/,
  /\bcurl\s+-[XLS]/,
  /\bwget\s+/,
  /\bcat\s+<</,
];

const GO_SIGNALS: RegExp[] = [
  /\bpackage\s+(main|\w+)\b/,
  /\bimport\s*\(/,
  /\bfunc\s+\w+\s*\(/,
  /\bfunc\s*\(\s*\w+\s+\w+\s*\)\s+\w+\s*\(/,
  /:=/,
  /\bfmt\.(Print|Printf|Println|Fprint|Sprint|Errorf)\b/,
  /\bhttp\.(HandleFunc|ListenAndServe|Get|Post|NewRequest)\b/,
  /\blog\.(Print|Printf|Println|Fatal|Panic)\b/,
  /\bos\.(Args|Getenv|Exit|Open|Stat)\b/,
  /\bdefer\s+\w+/,
  /\bgo\s+\w+\s*\(/,
  /\bchan\s+\w+/,
  /\brange\s+\w+/,
  /\berr\s*!=\s*nil/,
  /\berr\s*==\s*nil/,
  /\bnil\b/,
  /\binterface\s*\{\s*\}/,
  /\bstruct\s*\{/,
  /\btype\s+\w+\s+struct/,
  /\btype\s+\w+\s+interface/,
  /\bmap\[\w+\]\w+/,
  /\bmake\s*\(\s*(chan|map|slice)\b/,
  /\bappend\s*\(/,
  /\bpanic\s*\(/,
  /\brecover\s*\(/,
  /\bselect\s*\{/,
];

const RUST_SIGNALS: RegExp[] = [
  /\buse\s+std::/,
  /\buse\s+\w+::/,
  /\bfn\s+\w+\s*\(/,
  /\blet\s+(mut\s+)?\w+\s*[:=]/,
  /\bmut\s+\w+/,
  /\bprintln!\s*\(/,
  /\beprintln!\s*\(/,
  /\bprocess::exit\s*\(/,
  /\bunwrap\s*\(\s*\)/,
  /\bexpect\s*\(/,
  /\bmatch\s+\w+/,
  /\bimpl\s+\w+/,
  /\benum\s+\w+/,
  /\bstruct\s+\w+/,
  /\btrait\s+\w+/,
  /\bpub\s+(fn|struct|enum|trait|use)\s+/,
  /\bmod\s+\w+/,
  /\bcrate::\w+/,
  /\bself::\w+/,
  /\bsuper::\w+/,
  /\b->\s*\w+/,
  /\b!\s*\(/,  // macro call
  /\bvec!\s*\[/,
  /\bformat!\s*\(/,
  /\bString::\w+/,
  /\bVec<[^>]+>/,
  /\bOption<[^>]+>/,
  /\bResult<[^>]+>/,
  /\bSome\s*\(/,
  /\bNone\b/,
  /\bOk\s*\(/,
  /\bErr\s*\(/,
];

const KOTLIN_SIGNALS: RegExp[] = [
  /\bpackage\s+[\w.]+\s*$/,
  /\bimport\s+[\w.]+\s*$/,
  /\bclass\s+\w+\s*[\(?]/,
  /\bobject\s+\w+\s*[:{]/,
  /\bdata\s+class\s+\w+/,
  /\bfun\s+\w+\s*\(/,
  /\boverride\s+fun\s+/,
  /\blateinit\s+(var|val)\s+/,
  /\bval\s+\w+\s*[:=]/,
  /\bvar\s+\w+\s*[:=]/,
  /\bcompanion\s+object/,
  /\?:\s*/,
  /!!\s*$/,
  /\?\.\w+/,
  /\bwhen\s*\(/,
  /\bwhen\s*\{/,
  /\b->\s*/,
  /\brangeTo\s*\(/,
  /\bdownTo\s+/,
  /\bstep\s+\d+/,
  /\buntil\s+\d+/,
  /\bby\s+(lazy|delegate)/,
  /\binit\s*\{/,
  /\b@Composable\b/,
  /\bfindViewById\s*\(/,
  /\bsetContentView\s*\(/,
  /\bsetOnClickListener\s*\{/,
  /\bsuper\.\w+\s*\(/,
  /\bBundle\??\b/,
  /\b@IBOutlet\b/,
];

const HTML_SIGNALS: RegExp[] = [
  /<!DOCTYPE\s+html/i,
  /<html[^>]*>/i,
  /<head[^>]*>/i,
  /<body[^>]*>/i,
  /<div[^>]*>/i,
  /<script[^>]*>/i,
  /<style[^>]*>/i,
  /<link[^>]*>/i,
  /<meta[^>]*>/i,
  /<title[^>]*>/i,
  /<p[^>]*>/i,
  /<h[1-6][^>]*>/i,
  /<img[^>]*>/i,
  /<a\s+href/i,
  /<ul[^>]*>/i,
  /<ol[^>]*>/i,
  /<li[^>]*>/i,
  /<table[^>]*>/i,
  /<input[^>]*>/i,
  /<form[^>]*>/i,
  /<button[^>]*>/i,
  /<\/\w+>/,
  /\son\w+="[^"]*"/,  // onclick="..."
  /\bclass="[^"]*"/,
  /\bid="[^"]*"/,
];

const CSS_SIGNALS: RegExp[] = [
  /\.[a-zA-Z][\w-]*\s*\{/,
  /#[a-zA-Z][\w-]*\s*\{/,
  /\b@media\s+/,
  /\b@import\s+/,
  /\b@keyframes\s+/,
  /\b@font-face\s*\{/,
  /[a-zA-Z-]+\s*:\s*[^;]+;/,
  /\bcolor\s*:\s*(#[0-9a-fA-F]{3,8}|\w+)/,
  /\bbackground\s*:/,
  /\bbackground-color\s*:/,
  /\bmargin\s*:/,
  /\bpadding\s*:/,
  /\bborder\s*:/,
  /\bfont-(family|size|weight)\s*:/,
  /\bdisplay\s*:\s*(flex|grid|block|inline|none)/,
  /\bposition\s*:\s*(absolute|relative|fixed|sticky)/,
  /\b!important\b/,
  /\blinear-gradient\s*\(/,
  /\btransform\s*:/,
  /\btransition\s*:/,
  /\banimation\s*:/,
  /\bnth-child\s*\(/,
];

const JSON_SIGNALS: RegExp[] = [
  /^\s*\{\s*$/,
  /^\s*\}\s*,?\s*$/,
  /^\s*\[\s*$/,
  /^\s*\]\s*,?\s*$/,
  /^\s*"[^"]+"\s*:\s*/,
  /^\s*"[^"]+"\s*:\s*\{/,
  /^\s*"[^"]+"\s*:\s*\[/,
  /^\s*"[^"]+"\s*:\s*"/,
  /^\s*"[^"]+"\s*:\s*(true|false|null)/,
  /^\s*"[^"]+"\s*:\s*-?\d/,
  /\btrue\b/,
  /\bfalse\b/,
  /\bnull\b/,
];

const MATLAB_SIGNALS: RegExp[] = [
  /^\s*%\s/,  // comment
  /\bzeros\s*\(/,
  /\bones\s*\(/,
  /\brand\s*\(/,
  /\brandn\s*\(/,
  /\bfigure\s*;/,
  /\bfigure\s*\(/,
  /\bsubplot\s*\(/,
  /\bplot\s*\(/,
  /\bxlabel\s*\(/,
  /\bylabel\s*\(/,
  /\btitle\s*\(/,
  /\blegend\s*\(/,
  /\bgrid\s+(on|off)/,
  /\bhold\s+(on|off)/,
  /\baxis\s*\(/,
  /\bxlim\s*\(/,
  /\bylim\s*\(/,
  /\bdisp\s*\(/,
  /\bfprintf\s*\(/,
  /\bsprintf\s*\(/,
  /\binput\s*\(/,
  /\bsave\s+\w+\./,
  /\bload\s+\w+\./,
  /\bfunction\s+\w+\s*=/,
  /\bend\s*$/,
  /\bfor\s+\w+\s*=/,
  /\bwhile\s+\(/,
  /\bif\s+\(/,
  /\belseif\s+/,
  /\bswitch\s+/,
  /\bcase\s+['"]/,
  /\botherwise\b/,
  /\bbutter\s*\(/,
  /\bfiltfilt\s*\(/,
  /\bfft\s*\(/,
  /\bifft\s*\(/,
  /\bconv\s*\(/,
  /\bsin\s*\(/,
  /\bcos\s*\(/,
  /\btan\s*\(/,
  /\bexp\s*\(/,
  /\blog\s*\(/,
  /\bsqrt\s*\(/,
  /\babs\s*\(/,
  /\blength\s*\(/,
  /\bsize\s*\(/,
  /\breshape\s*\(/,
  /\bcell\s*\(/,
  /\bstruct\s*\(/,
  /\bstrcmp\s*\(/,
  /\bnum2str\s*\(/,
  /\bstr2num\s*\(/,
];

// Language → signals map (for scoring)
const ALL_LANGUAGE_SIGNALS: { lang: string; signals: RegExp[]; priority: number }[] = [
  // SQL has highest priority because its keywords are very specific
  { lang: "sql", signals: SQL_SIGNALS, priority: 3 },
  // HTML/CSS/JSON are structural and very distinctive
  { lang: "html", signals: HTML_SIGNALS, priority: 3 },
  { lang: "css", signals: CSS_SIGNALS, priority: 3 },
  { lang: "json", signals: JSON_SIGNALS, priority: 3 },
  // PHP has very specific tags
  { lang: "php", signals: PHP_SIGNALS, priority: 3 },
  // Bash has shebang and specific keywords
  { lang: "bash", signals: BASH_SIGNALS, priority: 3 },
  // MATLAB has distinctive syntax
  { lang: "matlab", signals: MATLAB_SIGNALS, priority: 2 },
  // Go/Rust/Kotlin have distinctive keywords
  { lang: "go", signals: GO_SIGNALS, priority: 3 },
  { lang: "rust", signals: RUST_SIGNALS, priority: 3 },
  { lang: "kotlin", signals: KOTLIN_SIGNALS, priority: 2 },
  // Java/C++ are similar, need careful scoring
  { lang: "java", signals: JAVA_SIGNALS, priority: 2 },
  { lang: "cpp", signals: CPP_SIGNALS, priority: 3 },
  // TypeScript is a superset of JavaScript, check TS first
  { lang: "typescript", signals: TYPESCRIPT_SIGNALS, priority: 2 },
  { lang: "javascript", signals: JAVASCRIPT_SIGNALS, priority: 2 },
  // Python and R — most common for stats modules
  { lang: "python", signals: PYTHON_SIGNALS, priority: 2 },
  { lang: "r", signals: R_SIGNALS, priority: 2 },
];

export function countMatches(code: string, patterns: RegExp[]): number {
  let n = 0;
  for (const p of patterns) if (p.test(code)) n++;
  return n;
}

// Check if code is JSON (starts with { or [)
function isJsonBlock(code: string): boolean {
  const trimmed = code.trim();
  if (!trimmed) return false;
  // Must start with { or [ and end with } or ]
  if (!/^[[{]/.test(trimmed)) return false;
  if (!/[\]}]$/.test(trimmed)) return false;
  // Count JSON-specific patterns line by line (patterns use ^ anchor)
  const lines = code.split(/\r?\n/);
  let jsonHits = 0;
  for (const line of lines) {
    for (const p of JSON_SIGNALS) {
      if (p.test(line)) {
        jsonHits++;
        break;  // one match per line is enough
      }
    }
  }
  return jsonHits >= 3;
}

// Check if code is HTML
function isHtmlBlock(code: string): boolean {
  const htmlHits = countMatches(code, HTML_SIGNALS);
  return htmlHits >= 2;
}

// Check if code is CSS
function isCssBlock(code: string): boolean {
  const cssHits = countMatches(code, CSS_SIGNALS);
  return cssHits >= 2;
}

// ─── Custom detection helpers (ported from Python language_detection.py) ───
// These functions provide more accurate detection for short snippets by
// combining multiple weak signals into a strong decision.

// R-specific patterns that pygments/highlight.js often miss
const R_PATTERNS_PY: RegExp[] = [
  /\b\w+\s*<-\s/,
  /\bcat\s*\(/,
  /\bqt\s*\(/,
  /\bqnorm\s*\(/,
  /\bqf\s*\(/,
  /\bqchisq\s*\(/,
  /\bqlnorm\s*\(/,
  /\bqbeta\s*\(/,
  /\blibrary\s*\(/,
  /\brequire\s*\(/,
  /\bread\.\w+\s*\(/,
  /\bdata\.frame\s*\(/,
  /\bggplot\s*\(/,
  /\bsummary\s*\(/,
  /\bhead\s*\(/,
  /\bstr\s*\(/,
  /\bsetwd\s*\(/,
  /\bset\.seed\s*\(/,
  /\bsample\s*\(/,
  /\b\w+\$[\w.]+/,
  /%>%/,
  /%<-%/,
  /%<>%/,
  /\bseq\s*\(/,
  /\brep\s*\(/,
  /\bsapply\s*\(/,
  /\blapply\s*\(/,
  /\bapply\s*\(/,
  /\bmapply\s*\(/,
  /\bvapply\s*\(/,
  /\bstop\s*\(/,
  /\bwarning\s*\(/,
  /\bmessage\s*\(/,
];

const SQL_KEYWORDS_RE = /\b(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|FROM|WHERE|JOIN|GROUP\s+BY|ORDER\s+BY|HAVING|UNION|VALUES|SET|TABLE|DATABASE|INDEX|VIEW|PROCEDURE|FUNCTION|TRIGGER|PRIMARY|FOREIGN|REFERENCES|CONSTRAINT|DEFAULT|NOT\s+NULL|AUTO_INCREMENT|SERIAL|CASCADE)\b/i;

const PHP_PATTERNS_PY: RegExp[] = [
  /<\?php/,
  /<\?=/,
  /\$\w+/,
  /\becho\s+\$/,
  /\bprint\s*\(/,
  /\bfunction\s+\w+\s*\([^)]*\$/,
  /\bclass\s+\w+\s*\{?[^}]*\$this->/,
];

const JAVA_PATTERNS_PY: RegExp[] = [
  /\bpublic\s+class\s+\w+/,
  /\bpublic\s+static\s+void\s+main\s*\(/,
  /\bSystem\.out\.print/,
  /\bimport\s+java\./,
  /\bprivate\s+\w+\s+\w+\s*[;=]/,
  /\bprotected\s+\w+\s+\w+\s*[;=]/,
  /\bextends\s+\w+/,
  /\bimplements\s+\w+/,
  /\bthrows\s+\w+/,
  /\bnew\s+\w+\s*\(/,
];

function detectR(code: string): boolean {
  const hits = R_PATTERNS_PY.filter(p => p.test(code)).length;
  const strongR = /\b(cat|qt|qnorm|qf|qchisq|qlnorm|qbeta|setwd|set\.seed|sapply|lapply|vapply|mapply)\s*\(/.test(code);
  const assignR = /\b\w+\s*<-/.test(code);
  const pipeR = /%>%|%<>%|%<-%/.test(code);
  const libR = /\blibrary\s*\(/.test(code);

  if ((strongR || pipeR || libR) && assignR) return true;
  if (assignR && hits >= 3) return true;
  if (hits >= 4) return true;

  // R-specific function calls (without <- assignment)
  const rStrongFunction = /\b(chisq\.test|cor\.test|t\.test|aov|glm|data\.frame|read\.csv|read\.table|read\.xlsx|cbind|rbind|row\.names|col\.names|row\.sums|col\.sums|apply|sapply|lapply|vapply|mapply|set\.seed|qt|qnorm|qf|qchisq|pt|pnorm|pf|pchisq|dt|dnorm|df|dchisq)\s*\(/.test(code);
  const rDollarNotation = /\b\w+\$\w+/.test(code);
  const rStringPaste = /\bpaste0?\s*\(/.test(code);
  const rMethodArg = /method\s*=\s*c\s*\(/.test(code);

  if (rStrongFunction) return true;
  if (rStrongFunction && (rDollarNotation || rStringPaste || rMethodArg)) return true;
  if (rDollarNotation && (rStringPaste || rMethodArg)) return true;
  return false;
}

function detectSql(code: string): boolean {
  const matches = code.match(new RegExp(SQL_KEYWORDS_RE.source, "gi"));
  if (!matches) return false;
  const uniqueKeywords = new Set(matches.map(m => m.toUpperCase()));
  return uniqueKeywords.size >= 2;
}

function detectBash(code: string): boolean {
  if (/^#!\s*\/(?:usr\/)?bin\/(?:bash|sh|zsh|ksh)/m.test(code)) return true;
  const bashPatterns = [
    /\b(if|then|fi|for|do|done|while|case|esac)\b/,
    /\$\{\w+\}/,
    /\$\(\([^)]+\)\)/,
    /^\s*(?:export|alias|source|chmod|chown|cd|mkdir|rm|cp|mv)\s/m,
  ];
  const hits = bashPatterns.filter(p => p.test(code)).length;
  return hits >= 2;
}

function detectPhp(code: string): boolean {
  // If it's bash, skip PHP detection
  if (detectBash(code)) return false;
  const phpHits = PHP_PATTERNS_PY.filter(p => p.test(code)).length;
  return phpHits >= 2 || /<\?php/.test(code);
}

function detectJava(code: string): boolean {
  const javaHits = JAVA_PATTERNS_PY.filter(p => p.test(code)).length;
  const hasCppMarker = /#include\s*[<"]/.test(code) || /\bstd::/.test(code);
  return javaHits >= 2 && !hasCppMarker;
}

function detectRuby(code: string): boolean {
  if (/^\s*def\s+\w+/m.test(code) && /^\s*end\s*$/m.test(code)) return true;
  if (/\bputs\s+/.test(code) && /#\{\w+\}/.test(code)) return true;
  return false;
}

export function detectLanguage(code: string): string {
  // Fast path: PHP detection (must check BEFORE HTML because PHP embeds HTML)
  if (/<\?php|<\?=/.test(code)) return "php";

  // Fast path: Bash shebang — very strong signal
  if (/^#!\/(bin|usr)\/(bash|sh|zsh)/m.test(code)) return "bash";

  // TypeScript detection — must check BEFORE HTML because TSX has HTML tags
  const hasTsTypes = /:\s*(string|number|boolean|void|any|unknown|never|Record|Array|Partial|Readonly|Pick|Omit|Promise|ReadonlyArray|Map|Set)\b/.test(code) ||
                     /\binterface\s+\w+\s*[\{<]/.test(code) ||
                     /\btype\s+\w+\s*=/.test(code) ||
                     /\bas\s+(const|unknown|any|string|number|boolean|Record|Array)\b/.test(code) ||
                     /<\w+,\s*\w+>\s*=/.test(code);
  const tsHits = countMatches(code, TYPESCRIPT_SIGNALS);
  if (hasTsTypes && tsHits > 0) return "typescript";

  // Structural detection (JSON/HTML/CSS) — after TypeScript check
  if (isJsonBlock(code)) return "json";
  if (isHtmlBlock(code)) {
    // Could be HTML with embedded CSS/JS — check ratios
    const cssHits = countMatches(code, CSS_SIGNALS);
    const jsHits = countMatches(code, JAVASCRIPT_SIGNALS);
    const htmlHits = countMatches(code, HTML_SIGNALS);
    if (htmlHits >= cssHits && htmlHits >= jsHits) return "html";
  }
  if (isCssBlock(code)) {
    const htmlHits = countMatches(code, HTML_SIGNALS);
    const cssHits = countMatches(code, CSS_SIGNALS);
    if (cssHits > htmlHits) return "css";
  }

  // ── Custom detection (ported from Python backend/app/language_detection.py) ──
  // This is more accurate than pure regex scoring for short snippets.

  // 1. R detection — strong patterns
  if (detectR(code)) return "r";
  // 2. SQL detection — 2+ unique SQL keywords
  if (detectSql(code)) return "sql";
  // 3. Bash detection — shebang + bash keywords
  if (detectBash(code)) return "bash";
  // 4. PHP detection — must come before bash (PHP can have shell-like patterns)
  if (detectPhp(code)) return "php";
  // 5. Java detection (distinguish from C++)
  if (detectJava(code)) return "java";
  // 6. Ruby detection — def...end pattern
  if (detectRuby(code)) return "ruby";
  // 7. Go — package + func
  if (/^\s*package\s+\w+\s*$/m.test(code) ||
      (/\bfunc\s+\w+\s*\(/.test(code) && /\bpackage\s+\w+/.test(code))) return "go";
  // 8. Rust — fn + let mut or println!
  if ((/\bfn\s+\w+\s*\(/.test(code) && /\blet\s+mut\s+\w+|println!/.test(code)) ||
      /println!/.test(code) || /\bpub\s+fn\s+/.test(code)) return "rust";
  // 9. Kotlin — fun + listOf/arrayOf/when (must be before Python `def`)
  if (/\bfun\s+\w+\s*\(/.test(code)) return "kotlin";
  if (/\bval\s+\w+\s*[=:]/.test(code) &&
      /\blistOf\(|\barrayOf\(|\bmutableListOf\(|\bsetOf\(|\bmapOf\(/.test(code)) return "kotlin";
  if (/\bwhen\s*\(/.test(code)) return "kotlin";
  // 10. TypeScript — type annotations
  if (/:\s*(string|number|boolean|any|void|never|unknown)\b/.test(code)) return "typescript";
  if (/\binterface\s+\w+\s*\{/.test(code)) return "typescript";
  if (/\btype\s+\w+\s*=/.test(code) && /\b(string|number|boolean|any)\b/.test(code)) return "typescript";
  // Generic type usage like `Map<K,V>` or `Array<T>` — but NOT C++ `vector<T>` or `template <T>`
  // Require both a type keyword AND a generic syntax to avoid C++ false positives.
  if (/\b(Array|Map|Set|Promise|Record|Partial|Readonly|Pick|Omit)<[^>]+>/.test(code)) return "typescript";
  if (/function\s+\w+\s*\([^)]*\)\s*:\s*\w+/.test(code)) return "typescript";
  if (/const\s+\w+\s*:\s*\w+\s*=/.test(code)) return "typescript";
  // 11. C++ — #include or std::
  if (/#include\s*[<"]/.test(code) || /\bstd::/.test(code)) return "cpp";
  if (/\bcout\s*<<|\bcin\s*>>/.test(code)) return "cpp";
  // 12. C — int main() without std::
  if (/\bint\s+main\s*\([^)]*\)\s*\{/.test(code) &&
      !/\bstd::/.test(code) && !/#include/.test(code)) return "c";
  // 13. Python — def, import, from, class with colon
  if (/^\s*def\s+\w+\s*\([^)]*\)\s*:/m.test(code)) return "python";
  if (/^\s*(import\s+\w+|from\s+\w+\s+import\s+)/m.test(code)) return "python";
  if (/\bprint\s*\(/.test(code) && !/\bSystem\.out|\bconsole\.log|\bcout\s*<</.test(code)) {
    if (!/<-|library\(/.test(code)) return "python";
  }
  // 14. JavaScript — const, let, var, function, console.log
  if (/\bconsole\.log\s*\(/.test(code)) return "javascript";
  if (/^\s*(?:const|let|var)\s+\w+\s*=/m.test(code)) return "javascript";
  if (/^\s*function\s+\w+\s*\(/m.test(code)) return "javascript";
  if (/=>\s*[\({\w]/.test(code)) return "javascript";

  // Score each language
  const scores: { lang: string; score: number }[] = [];
  for (const { lang, signals, priority } of ALL_LANGUAGE_SIGNALS) {
    if (lang === "json" || lang === "html" || lang === "css" || lang === "typescript") continue; // already handled
    const hits = countMatches(code, signals);
    if (hits > 0) {
      scores.push({ lang, score: hits * priority });
    }
  }

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  if (scores.length === 0) {
    // Fallback: check for R-specific patterns
    if (/<-/.test(code)) return "r";
    if (/\blibrary\s*\(/.test(code)) return "r";
    return "unknown";
  }

  // If no TS-specific types, remove TS from scores (it was only matching JS patterns)
  const filteredScores = scores.filter(s => s.lang !== "typescript");

  // ── HIGH PRIORITY: language-specific distinctive keywords ──

  // Rust: `fn `, `let mut`, `pub fn`, `use std::`, `println!`, `impl ` are very distinctive
  if (/\bfn\s+\w+/.test(code) || /\blet\s+mut\s+/.test(code) ||
      /\bpub\s+fn\s+/.test(code) || /\bprintln!\s*\(/.test(code) ||
      /\bimpl\s+\w+/.test(code) || /\buse\s+std::/.test(code)) {
    return "rust";
  }

  // Go: `func `, `package main`, `:=`, `fmt.`, `err != nil` are very distinctive
  if (/\bfunc\s+\w+\s*\(/.test(code) || /\bpackage\s+main\b/.test(code) ||
      /:=/.test(code) || /\bfmt\.\w+/.test(code) || /\berr\s*!=\s*nil/.test(code)) {
    return "go";
  }

  // Kotlin: `fun `, `val `, `companion object`, `lateinit`, `override fun` are very distinctive
  if (/\bfun\s+\w+\s*\(/.test(code) || /\bval\s+\w+/.test(code) ||
      /\bcompanion\s+object/.test(code) || /\blateinit\s+/.test(code) ||
      /\boverride\s+fun\s+/.test(code)) {
    return "kotlin";
  }

  // C++: `#include`, `std::`, `cout <<`, `using namespace` are very distinctive
  if (/#include\s+[<"]/.test(code) || /\bstd::/.test(code) ||
      /\bcout\s*<</.test(code) || /\busing\s+namespace\s+/.test(code) ||
      /\btemplate\s*</.test(code)) {
    return "cpp";
  }

  // Java: `System.out.`, `public class`, `import java.`, `@Override` are distinctive
  if (/\bSystem\.(out|err)\./.test(code) || /\bimport\s+java\./.test(code) ||
      /\bpublic\s+class\s+\w+/.test(code)) {
    return "java";
  }

  // Python: `def `, `import `, `from X import`, `self.`, `print(`, `__init__` are distinctive
  // Check Python BEFORE Go/Rust because Go's `return` is too broad
  if (/\bdef\s+\w+\s*\(/.test(code) || /\bfrom\s+\w+\s+import/.test(code) ||
      /\bclass\s+\w+.*:\s*$/m.test(code) || /\bself\.\w+/.test(code) ||
      /\b__init__\s*\(/.test(code) || /\b__name__/.test(code) ||
      /\bimport\s+(pandas|numpy|matplotlib|scipy|sklearn|tensorflow|torch)\b/.test(code) ||
      /\.\bappend\s*\(/.test(code) || /\.\bextend\s*\(/.test(code) ||
      /\bplt\.\w+/.test(code) || /\bpd\.\w+/.test(code) || /\bnp\.\w+/.test(code)) {
    return "python";
  }

  // R: `<-`, `library(`, `data.frame(` are distinctive
  if (/<-/.test(code) || /\blibrary\s*\(/.test(code) || /\bdata\.frame\s*\(/.test(code)) {
    return "r";
  }

  // Special case: C++ vs Java (already handled above, but fallback)
  const cppScore = filteredScores.find(s => s.lang === "cpp")?.score || 0;
  const javaScore = filteredScores.find(s => s.lang === "java")?.score || 0;
  if (cppScore > 0 && cppScore >= javaScore) {
    return "cpp";
  }

  // Special case: Kotlin vs Java
  const kotlinScore = filteredScores.find(s => s.lang === "kotlin")?.score || 0;
  if (kotlinScore > 0 && kotlinScore >= javaScore) {
    return "kotlin";
  }

  if (filteredScores.length === 0) return "unknown";
  return filteredScores[0].lang;
}

// List of supported languages for the UI selector.
// IMPORTANT: "auto" is intentionally REMOVED — the user MUST choose a
// programming language before extraction. This is by design: forcing the
// language selection eliminates misclassification and ensures every block
// in the output uses the correct language. The left panel language selector
// acts as a force-override: ALL extracted blocks will use this language.
export const SUPPORTED_LANGS: { value: string; label: string; emoji: string }[] = [
  { value: "r", label: "R", emoji: "📊" },
  { value: "python", label: "Python", emoji: "🐍" },
  { value: "sql", label: "SQL", emoji: "🗃️" },
  { value: "java", label: "Java", emoji: "☕" },
  { value: "cpp", label: "C++", emoji: "⚙️" },
  { value: "javascript", label: "JavaScript", emoji: "⚡" },
  { value: "typescript", label: "TypeScript", emoji: "🔷" },
  { value: "php", label: "PHP", emoji: "🐘" },
  { value: "kotlin", label: "Kotlin", emoji: "🟣" },
  { value: "go", label: "Go", emoji: "🐹" },
  { value: "rust", label: "Rust", emoji: "🦀" },
  { value: "bash", label: "Bash", emoji: "🖥️" },
  { value: "html", label: "HTML", emoji: "🌐" },
  { value: "css", label: "CSS", emoji: "🎨" },
  { value: "json", label: "JSON", emoji: "📋" },
];

// Export all signal arrays for use in line-classify.ts
export {
  JAVA_SIGNALS,
  CPP_SIGNALS,
  JAVASCRIPT_SIGNALS,
  TYPESCRIPT_SIGNALS,
  PHP_SIGNALS,
  BASH_SIGNALS,
  GO_SIGNALS,
  RUST_SIGNALS,
  KOTLIN_SIGNALS,
  HTML_SIGNALS,
  CSS_SIGNALS,
  JSON_SIGNALS,
  MATLAB_SIGNALS,
  PYTHON_SIGNALS,
  SQL_SIGNALS,
};
