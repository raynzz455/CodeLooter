"""Language detection via pygments + custom overrides.

Strategi (UPGRADED to parity with the TS/Next.js version — Task 21):
1. PHP `<?php` tag fast-path (before HTML — PHP embeds HTML).
2. Bash shebang fast-path.
3. TypeScript type-annotation check (must have `: Type`, `interface`, `type X =`).
4. Structural detection (JSON/HTML/CSS) via isJsonBlock/isHtmlBlock/isCssBlock.
5. Custom detection helpers (ported from TS detectR/detectSql/detectBash/detectPhp/
   detectJava/detectRuby) — these combine multiple weak signals into strong decisions.
6. Priority chain of distinctive keywords: Rust -> Go -> Kotlin -> C++ -> Java -> Python -> R.
7. Score each language's signal array (12 new arrays added in this upgrade).
8. pygments guess_lexer as last resort.
9. Fallback to "unknown".
"""
import re
import json
from pygments.lexers import guess_lexer
from pygments.util import ClassNotFound


# Bahasa yang didukung CodeLooter (sesuai mapping ekstensi file di snippets.py)
SUPPORTED_LANGS = {
    "python", "r", "javascript", "typescript", "java", "cpp", "c",
    "sql", "kotlin", "php", "ruby", "go", "rust", "swift", "scala",
    "bash", "shell", "html", "css", "json", "yaml", "markdown",
    "matlab",
}


# ── R signals (khas modul statistik Indonesia) ──
R_SIGNALS = [
    re.compile(r"<-"),
    re.compile(r"\blibrary\s*\("),
    re.compile(r"\brequire\s*\("),
    re.compile(r"\bcat\s*\("),
    re.compile(r"\bqt\s*\("),
    re.compile(r"\bqnorm\s*\("),
    re.compile(r"\bqf\s*\("),
    re.compile(r"\bqchisq\s*\("),
    re.compile(r"\bpt\s*\("),
    re.compile(r"\bpnorm\s*\("),
    re.compile(r"\bpf\s*\("),
    re.compile(r"\bdnorm\s*\("),
    re.compile(r"\bdchisq\s*\("),
    re.compile(r"\bdt\s*\("),
    re.compile(r"\bsummary\s*\("),
    re.compile(r"\blm\s*\("),
    re.compile(r"\bglm\s*\("),
    re.compile(r"\baov\s*\("),
    re.compile(r"\bcor\.test\s*\("),
    re.compile(r"\bchisq\.test\s*\("),
    re.compile(r"\bt\.test\s*\("),
    re.compile(r"\bwilcox\.test\s*\("),
    re.compile(r"\bmann\.whitney\s*\("),
    re.compile(r"\bkruskal\.test\s*\("),
    re.compile(r"\bshapiro\.test\s*\("),
    re.compile(r"\bdata\.frame\s*\("),
    re.compile(r"\bread\.csv\s*\("),
    re.compile(r"\bread\.table\s*\("),
    re.compile(r"\bread\.xlsx\s*\("),
    re.compile(r"\bread\.delim\s*\("),
    re.compile(r"\bset\.seed\s*\("),
    re.compile(r"\bsample\s*\("),
    re.compile(r"\bggplot\s*\("),
    re.compile(r"\baes\s*\("),
    re.compile(r"\bgeom_\w+\s*\("),
    re.compile(r"\bfacet_\w+\s*\("),
    re.compile(r"\btheme_\w+\s*\("),
    re.compile(r"\bqqnorm\s*\("),
    re.compile(r"\bqqline\s*\("),
    re.compile(r"\bpar\s*\("),
    re.compile(r"\bplot\s*\("),
    re.compile(r"\babline\s*\("),
    re.compile(r"\bhist\s*\("),
    re.compile(r"\bboxplot\s*\("),
    re.compile(r"\bpredict\s*\("),
    re.compile(r"\bconfint\s*\("),
    re.compile(r"\bresiduals\s*\("),
    re.compile(r"%>%"),
    re.compile(r"%[+\*]%"),
    re.compile(r"\b\w+\$\w+"),  # data$column
    re.compile(r"\bprint\s*\("),
    re.compile(r"\bmean\s*\("),
    re.compile(r"\bmedian\s*\("),
    re.compile(r"\bsd\s*\("),
    re.compile(r"\bvar\s*\("),
    re.compile(r"\bsqrt\s*\("),
    re.compile(r"\babs\s*\("),
    re.compile(r"\bround\s*\("),
    re.compile(r"\bfloor\s*\("),
    re.compile(r"\bceiling\s*\("),
    re.compile(r"\bcbind\s*\("),
    re.compile(r"\brbind\s*\("),
    re.compile(r"\bhead\s*\("),
    re.compile(r"\btail\s*\("),
    re.compile(r"\bstr\s*\("),
    re.compile(r"\bglimpse\s*\("),
    re.compile(r"\bseq\s*\("),
    re.compile(r"\brep\s*\("),
    re.compile(r"\bc\s*\("),
    re.compile(r"\bas\.matrix\s*\("),
    re.compile(r"\bas\.data\.frame\s*\("),
    re.compile(r"\bas\.numeric\s*\("),
    re.compile(r"\bas\.character\s*\("),
    re.compile(r"\btextConnection\s*\("),
    re.compile(r"\bwrite\.csv\s*\("),
    re.compile(r"\bwrite\.table\s*\("),
    re.compile(r"\btable\s*\("),
    re.compile(r"\bprop\.table\s*\("),
    re.compile(r"\bmargin\.table\s*\("),
    re.compile(r"\baddmargins\s*\("),
    re.compile(r"\bfactor\s*\("),
    re.compile(r"\blevels\s*\("),
    re.compile(r"\bnames\s*\("),
    re.compile(r"\bcolnames\s*\("),
    re.compile(r"\brownames\s*\("),
    re.compile(r"\bnrow\s*\("),
    re.compile(r"\bncol\s*\("),
    re.compile(r"\bdim\s*\("),
    re.compile(r"\blength\s*\("),
    re.compile(r"\bsort\s*\("),
    re.compile(r"\border\s*\("),
    re.compile(r"\bunique\s*\("),
    re.compile(r"\bduplicated\s*\("),
    re.compile(r"\bsubset\s*\("),
    re.compile(r"\bfilter\s*\("),
    re.compile(r"\bmutate\s*\("),
    re.compile(r"\bselect\s*\("),
    re.compile(r"\bgroup_by\s*\("),
    re.compile(r"\bsummarise\s*\("),
    re.compile(r"\bsummarize\s*\("),
    re.compile(r"\barrange\s*\("),
    re.compile(r"\bpaste\s*\("),
    re.compile(r"\bpaste0\s*\("),
    re.compile(r"\bsprintf\s*\("),
    re.compile(r"\bnchar\s*\("),
    re.compile(r"\btolower\s*\("),
    re.compile(r"\btoupper\s*\("),
    re.compile(r"\bsubstr\s*\("),
    re.compile(r"\bgsub\s*\("),
]


# ── Python signals ──
PYTHON_SIGNALS = [
    re.compile(r"\bdef\s+\w+\s*\("),
    re.compile(r"\bimport\s+\w+"),
    re.compile(r"\bfrom\s+\w+\s+import"),
    re.compile(r"\bprint\s*\("),
    re.compile(r"\bif\s+__name__"),
    re.compile(r"\bself\b"),
    re.compile(r"\bnp\."),
    re.compile(r"\bpd\."),
    re.compile(r"\bplt\."),
    re.compile(r"\bsns\."),
    re.compile(r"\belif\s+"),
    re.compile(r"\bexcept\s+\w+"),
    re.compile(r"\braise\s+\w+"),
    re.compile(r"\byield\s"),
    re.compile(r"\blambda\s+"),
    re.compile(r"\basync\s+def\s"),
    re.compile(r"\bawait\s+"),
    re.compile(r"\bf[\"'].*\{.*\}.*[\"']"),  # f-string
    re.compile(r"\bclass\s+\w+.*:"),
    re.compile(r"\b__init__\s*\("),
    re.compile(r"\b__name__"),
    re.compile(r"\b__main__"),
    # Python-specific list methods (not Go's append)
    re.compile(r"\.\bappend\s*\("),
    re.compile(r"\.\bextend\s*\("),
    re.compile(r"\.\bsort\s*\("),
    re.compile(r"\.\breverse\s*\("),
    re.compile(r"\.\bpop\s*\("),
    re.compile(r"\.\binsert\s*\("),
    re.compile(r"\.\bremove\s*\("),
]


# ── SQL signals ──
SQL_SIGNALS = [
    re.compile(r"\bSELECT\b", re.IGNORECASE),
    re.compile(r"\bFROM\b", re.IGNORECASE),
    re.compile(r"\bWHERE\b", re.IGNORECASE),
    re.compile(r"\bJOIN\b", re.IGNORECASE),
    re.compile(r"\bINSERT\s+INTO\b", re.IGNORECASE),
    re.compile(r"\bCREATE\s+TABLE\b", re.IGNORECASE),
    re.compile(r"\bUPDATE\s+\w+\s+SET\b", re.IGNORECASE),
    re.compile(r"\bDELETE\s+FROM\b", re.IGNORECASE),
    re.compile(r"\bGROUP\s+BY\b", re.IGNORECASE),
    re.compile(r"\bORDER\s+BY\b", re.IGNORECASE),
    re.compile(r"\bHAVING\b", re.IGNORECASE),
    re.compile(r"\bPRIMARY\s+KEY\b", re.IGNORECASE),
    re.compile(r"\bFOREIGN\s+KEY\b", re.IGNORECASE),
    re.compile(r"\bAUTO_INCREMENT\b", re.IGNORECASE),
    re.compile(r"\bVARCHAR\b", re.IGNORECASE),
    re.compile(r"\bDECIMAL\b", re.IGNORECASE),
    re.compile(r"\bINNER\s+JOIN\b", re.IGNORECASE),
    re.compile(r"\bLEFT\s+JOIN\b", re.IGNORECASE),
]


# ── NEW: Comprehensive language signals for 15 languages (Task 21) ──

JAVA_SIGNALS = [
    re.compile(r"\bpublic\s+class\s+\w+"),
    re.compile(r"\bprivate\s+(static\s+)?\w+\s+\w+\s*[=;]"),
    re.compile(r"\bprotected\s+\w+\s+\w+"),
    re.compile(r"\bpublic\s+(static\s+)?(void|int|String|double|boolean|long|float|char)\s+\w+\s*\("),
    re.compile(r"\bvoid\s+\w+\s*\("),
    re.compile(r"\bSystem\.(out|err)\."),
    re.compile(r"\bimport\s+java\."),
    re.compile(r"\bnew\s+\w+\s*\("),
    re.compile(r"\bthis\.\w+"),
    re.compile(r"@\w+(?:\.\w+)*\s*\n?\s*(?:public|private|protected|static)"),
    re.compile(r"\bextends\s+\w+"),
    re.compile(r"\bimplements\s+\w+"),
    re.compile(r"\breturn\s+(new\s+)?\w+"),
    re.compile(r"\bnull\b"),
    re.compile(r"\btrue\b"),
    re.compile(r"\bfalse\b"),
    re.compile(r"\binstanceof\s+\w+"),
    re.compile(r"\bthrows\s+\w+"),
]

CPP_SIGNALS = [
    re.compile(r"#include\s+[<\"]"),
    re.compile(r"#define\s+\w+"),
    re.compile(r"#ifndef\s+\w+"),
    re.compile(r"#pragma\s+(once|hdrstop)"),
    re.compile(r"\busing\s+namespace\s+"),
    re.compile(r"\btemplate\s*<[^>]*>"),
    re.compile(r"\bstd::\w+"),
    re.compile(r"\bcout\s*<<"),
    re.compile(r"\bcin\s*>>"),
    re.compile(r"\bcerr\s*<<"),
    re.compile(r"\bint\s+main\s*\("),
    re.compile(r"\bendl\b"),
    re.compile(r"\bnullptr\b"),
    re.compile(r"\bnew\s+\w+\s*\["),
    re.compile(r"\bdelete\s+\w+"),
    re.compile(r"\b::\w+"),
    re.compile(r"->\w+"),
    re.compile(r"\bconst\s+\w+\s*&"),
    re.compile(r"\bunsigned\s+(int|long|short)"),
    re.compile(r"\bsize_t\b"),
    re.compile(r"\bauto\s+\w+\s*="),
    re.compile(r"\blambda\s+"),
    re.compile(r"\bnamespace\s+\w+"),
]

JAVASCRIPT_SIGNALS = [
    re.compile(r"\bconst\s+\w+\s*="),
    re.compile(r"\blet\s+\w+\s*="),
    re.compile(r"\bvar\s+\w+\s*="),
    re.compile(r"\bfunction\s+\w+\s*\("),
    re.compile(r"=>\s*[{(]"),
    re.compile(r"\bconsole\.(log|error|warn|info)\s*\("),
    re.compile(r"\bdocument\.\w+"),
    re.compile(r"\bwindow\.\w+"),
    re.compile(r"\brequire\s*\(\s*['\"]"),
    re.compile(r"\bmodule\.exports\b"),
    re.compile(r"\bexport\s+(default\s+)?(const|function|class)\s+"),
    re.compile(r"\bimport\s+.*from\s+['\"]"),
    re.compile(r"\basync\s+function\s+"),
    re.compile(r"\bawait\s+"),
    re.compile(r"\btypeof\s+\w+"),
    re.compile(r"\binstanceof\s+\w+"),
    re.compile(r"\bnew\s+\w+\s*\("),
    re.compile(r"\bJSON\.(parse|stringify)\s*\("),
    re.compile(r"\bArray\.\w+\s*\("),
    re.compile(r"\bObject\.\w+\s*\("),
    re.compile(r"\bPromise\s*\("),
    re.compile(r"\bthrow\s+new\s+\w+"),
]

TYPESCRIPT_SIGNALS = [
    re.compile(r"\binterface\s+\w+\s*\{"),
    re.compile(r"\btype\s+\w+\s*="),
    re.compile(r"\bexport\s+(default\s+)?(const|function|class|interface|type|enum)\s+"),
    re.compile(r":\s*\w+<[^>]*>"),  # generic type annotation
    re.compile(r"\bas\s+\w+\b"),
    re.compile(r"\breadonly\s+\w+"),
    re.compile(r"\bnamespace\s+\w+"),
    re.compile(r"\bimport\s+.*from\s+['\"]"),
    re.compile(r"\babstract\s+class\s+"),
    re.compile(r"\bimplements\s+\w+"),
    re.compile(r"\bextends\s+\w+"),
    re.compile(r"\bprivate\s+\w+\s*:"),
    re.compile(r"\bpublic\s+\w+\s*:"),
    re.compile(r"\bprotected\s+\w+\s*:"),
    re.compile(r"@\w+"),
    # TS is a superset of JS — JS signals are also relevant for scoring.
]

PHP_SIGNALS = [
    re.compile(r"<\?php"),
    re.compile(r"<\?="),
    re.compile(r"\?>"),
    re.compile(r"\$\w+\s*="),
    re.compile(r"\$\w+\s*->\s*\w+"),
    re.compile(r"\bfunction\s+\w+\s*\([^)]*\)\s*\{"),
    re.compile(r"\barray\s*\("),
    re.compile(r"\bforeach\s*\("),
    re.compile(r"\becho\s+"),
    re.compile(r"\bnew\s+\w+\s*\("),
    re.compile(r"\bthis->\w+"),  # $ stripped for safety
    re.compile(r"::\w+\("),
    re.compile(r"\b__construct\s*\("),
    re.compile(r"\bpublic\s+(static\s+)?function\s+"),
    re.compile(r"\bprivate\s+(static\s+)?function\s+"),
    re.compile(r"\bprotected\s+(static\s+)?function\s+"),
    re.compile(r"\bclass\s+\w+\s*(?:extends|implements)\s+"),
    re.compile(r"\bnamespace\s+\w+"),
    re.compile(r"\buse\s+\\?\w+(?:\\+\w+)*"),
    re.compile(r"\bPDO::\w+"),
    re.compile(r"\bjson_encode\s*\("),
    re.compile(r"\bjson_decode\s*\("),
    re.compile(r"\bheader\s*\(\s*['\"]"),
    # NOTE: print() removed — too common across languages (Python, R, PHP, JS).
]

BASH_SIGNALS = [
    re.compile(r"^#!\/(bin|usr)\/(bash|sh|zsh)", re.MULTILINE),
    re.compile(r"\bset\s+-[eu]"),
    re.compile(r"\becho\s+[\"-]"),
    re.compile(r"\bif\s*\[\s"),
    re.compile(r"\bfi\b"),
    re.compile(r"\bfor\s+\w+\s+in\s+"),
    re.compile(r"\bdone\b"),
    re.compile(r"\bwhile\s+\["),
    re.compile(r"\bwhile\s+read\s+"),
    re.compile(r"\bcase\s+.*\s+in"),
    re.compile(r"\besac\b"),
    re.compile(r"\bexport\s+\w+="),
    re.compile(r"\blocal\s+\w+="),
    re.compile(r"\breadonly\s+\w+"),
    re.compile(r"\$\{\w+\}"),
    re.compile(r"\$\(\([^)]+\)\)"),
    re.compile(r"\$\([^)]+\)"),
    re.compile(r"\bthen\b"),
    re.compile(r"\bdo\b"),
    re.compile(r"\belif\b"),
    re.compile(r"\belse\b"),
    re.compile(r"\bcd\s+\w"),
    re.compile(r"\btar\s+-[czx]"),
    re.compile(r"\bgit\s+(pull|push|clone|commit|add|checkout|branch|merge)"),
    re.compile(r"\bnpm\s+(install|run|ci|test|build|start)"),
    re.compile(r"\bsystemctl\s+(start|stop|restart|status|enable|disable)"),
    re.compile(r"\bapt(?:-get)?\s+(install|update|upgrade|remove)"),
    re.compile(r"\byum\s+(install|update|remove)"),
    re.compile(r"\bdocker\s+(run|build|pull|push|compose)"),
    re.compile(r"\bmkdir\s+-p\s"),
    re.compile(r"\brm\s+-rf\s"),
    re.compile(r"\bcp\s+-r\s"),
    re.compile(r"\bmv\s+\w+\s+\w+"),
    re.compile(r"\bchmod\s+\d+\s"),
    re.compile(r"\bchown\s+\w+:\w+\s"),
    re.compile(r"\bgrep\s+-[rRn]"),
    re.compile(r"\bsed\s+-[i]"),
    re.compile(r"\bawk\s+['{]"),
    re.compile(r"\bwc\s+-[lwc]"),
    re.compile(r"\bcurl\s+-[XLS]"),
    re.compile(r"\bwget\s+"),
    re.compile(r"\bcat\s+<<"),
]

GO_SIGNALS = [
    re.compile(r"\bpackage\s+(main|\w+)\b"),
    re.compile(r"\bimport\s*\("),
    re.compile(r"\bfunc\s+\w+\s*\("),
    re.compile(r"\bfunc\s*\(\s*\w+\s+\w+\s*\)\s+\w+\s*\("),
    re.compile(r":="),
    re.compile(r"\bfmt\.(Print|Printf|Println|Fprint|Sprint|Errorf)\b"),
    re.compile(r"\bhttp\.(HandleFunc|ListenAndServe|Get|Post|NewRequest)\b"),
    re.compile(r"\blog\.(Print|Printf|Println|Fatal|Panic)\b"),
    re.compile(r"\bos\.(Args|Getenv|Exit|Open|Stat)\b"),
    re.compile(r"\bdefer\s+\w+"),
    re.compile(r"\bgo\s+\w+\s*\("),
    re.compile(r"\bchan\s+\w+"),
    re.compile(r"\brange\s+\w+"),
    re.compile(r"\berr\s*!=\s*nil"),
    re.compile(r"\berr\s*==\s*nil"),
    re.compile(r"\bnil\b"),
    re.compile(r"\binterface\s*\{\s*\}"),
    re.compile(r"\bstruct\s*\{"),
    re.compile(r"\btype\s+\w+\s+struct"),
    re.compile(r"\btype\s+\w+\s+interface"),
    re.compile(r"\bmap\[\w+\]\w+"),
    re.compile(r"\bmake\s*\(\s*(chan|map|slice)\b"),
    re.compile(r"\bappend\s*\("),
    re.compile(r"\bpanic\s*\("),
    re.compile(r"\brecover\s*\("),
    re.compile(r"\bselect\s*\{"),
]

RUST_SIGNALS = [
    re.compile(r"\buse\s+std::"),
    re.compile(r"\buse\s+\w+::"),
    re.compile(r"\bfn\s+\w+\s*\("),
    re.compile(r"\blet\s+(mut\s+)?\w+\s*[:=]"),
    re.compile(r"\bmut\s+\w+"),
    re.compile(r"\bprintln!\s*\("),
    re.compile(r"\beprintln!\s*\("),
    re.compile(r"\bprocess::exit\s*\("),
    re.compile(r"\bunwrap\s*\(\s*\)"),
    re.compile(r"\bexpect\s*\("),
    re.compile(r"\bmatch\s+\w+"),
    re.compile(r"\bimpl\s+\w+"),
    re.compile(r"\benum\s+\w+"),
    re.compile(r"\bstruct\s+\w+"),
    re.compile(r"\btrait\s+\w+"),
    re.compile(r"\bpub\s+(fn|struct|enum|trait|use)\s+"),
    re.compile(r"\bmod\s+\w+"),
    re.compile(r"\bcrate::\w+"),
    re.compile(r"\bself::\w+"),
    re.compile(r"\bsuper::\w+"),
    re.compile(r"->\s*\w+"),
    re.compile(r"\b!\s*\("),
    re.compile(r"\bvec!\s*\["),
    re.compile(r"\bformat!\s*\("),
    re.compile(r"\bString::\w+"),
    re.compile(r"\bVec<[^>]+>"),
    re.compile(r"\bOption<[^>]+>"),
    re.compile(r"\bResult<[^>]+>"),
    re.compile(r"\bSome\s*\("),
    re.compile(r"\bNone\b"),
    re.compile(r"\bOk\s*\("),
    re.compile(r"\bErr\s*\("),
]

KOTLIN_SIGNALS = [
    re.compile(r"\bpackage\s+[\w.]+\s*$", re.MULTILINE),
    re.compile(r"\bimport\s+[\w.]+\s*$", re.MULTILINE),
    re.compile(r"\bclass\s+\w+\s*[\(?]"),
    re.compile(r"\bobject\s+\w+\s*[:{]"),
    re.compile(r"\bdata\s+class\s+\w+"),
    re.compile(r"\bfun\s+\w+\s*\("),
    re.compile(r"\boverride\s+fun\s+"),
    re.compile(r"\blateinit\s+(var|val)\s+"),
    re.compile(r"\bval\s+\w+\s*[:=]"),
    re.compile(r"\bvar\s+\w+\s*[:=]"),
    re.compile(r"\bcompanion\s+object"),
    re.compile(r"\?:"),
    re.compile(r"!!\s*$"),
    re.compile(r"\?\.\w+"),
    re.compile(r"\bwhen\s*\("),
    re.compile(r"\bwhen\s*\{"),
    re.compile(r"->"),
    re.compile(r"\brangeTo\s*\("),
    re.compile(r"\bdownTo\s+"),
    re.compile(r"\bstep\s+\d+"),
    re.compile(r"\buntil\s+\d+"),
    re.compile(r"\bby\s+(lazy|delegate)"),
    re.compile(r"\binit\s*\{"),
    re.compile(r"@Composable\b"),
    re.compile(r"\bfindViewById\s*\("),
    re.compile(r"\bsetContentView\s*\("),
    re.compile(r"\bsetOnClickListener\s*\{"),
    re.compile(r"\bsuper\.\w+\s*\("),
    re.compile(r"\bBundle\??\b"),
    re.compile(r"@IBOutlet\b"),
]

HTML_SIGNALS = [
    re.compile(r"<!DOCTYPE\s+html", re.IGNORECASE),
    re.compile(r"<html[^>]*>", re.IGNORECASE),
    re.compile(r"<head[^>]*>", re.IGNORECASE),
    re.compile(r"<body[^>]*>", re.IGNORECASE),
    re.compile(r"<div[^>]*>", re.IGNORECASE),
    re.compile(r"<script[^>]*>", re.IGNORECASE),
    re.compile(r"<style[^>]*>", re.IGNORECASE),
    re.compile(r"<link[^>]*>", re.IGNORECASE),
    re.compile(r"<meta[^>]*>", re.IGNORECASE),
    re.compile(r"<title[^>]*>", re.IGNORECASE),
    re.compile(r"<p[^>]*>", re.IGNORECASE),
    re.compile(r"<h[1-6][^>]*>", re.IGNORECASE),
    re.compile(r"<img[^>]*>", re.IGNORECASE),
    re.compile(r"<a\s+href", re.IGNORECASE),
    re.compile(r"<ul[^>]*>", re.IGNORECASE),
    re.compile(r"<ol[^>]*>", re.IGNORECASE),
    re.compile(r"<li[^>]*>", re.IGNORECASE),
    re.compile(r"<table[^>]*>", re.IGNORECASE),
    re.compile(r"<input[^>]*>", re.IGNORECASE),
    re.compile(r"<form[^>]*>", re.IGNORECASE),
    re.compile(r"<button[^>]*>", re.IGNORECASE),
    re.compile(r"</\w+>"),
    re.compile(r"\son\w+=\"[^\"]*\""),
    re.compile(r"\bclass=\"[^\"]*\""),
    re.compile(r"\bid=\"[^\"]*\""),
]

CSS_SIGNALS = [
    re.compile(r"\.[a-zA-Z][\w-]*\s*\{"),
    re.compile(r"#[a-zA-Z][\w-]*\s*\{"),
    re.compile(r"\b@media\s+"),
    re.compile(r"\b@import\s+"),
    re.compile(r"\b@keyframes\s+"),
    re.compile(r"\b@font-face\s*\{"),
    re.compile(r"[a-zA-Z-]+\s*:\s*[^;]+;"),
    re.compile(r"\bcolor\s*:\s*(#[0-9a-fA-F]{3,8}|\w+)"),
    re.compile(r"\bbackground\s*:"),
    re.compile(r"\bbackground-color\s*:"),
    re.compile(r"\bmargin\s*:"),
    re.compile(r"\bpadding\s*:"),
    re.compile(r"\bborder\s*:"),
    re.compile(r"\bfont-(family|size|weight)\s*:"),
    re.compile(r"\bdisplay\s*:\s*(flex|grid|block|inline|none)"),
    re.compile(r"\bposition\s*:\s*(absolute|relative|fixed|sticky)"),
    re.compile(r"\b!important\b"),
    re.compile(r"\blinear-gradient\s*\("),
    re.compile(r"\btransform\s*:"),
    re.compile(r"\btransition\s*:"),
    re.compile(r"\banimation\s*:"),
    re.compile(r"\bnth-child\s*\("),
]

JSON_SIGNALS = [
    re.compile(r"^\s*\{\s*$"),
    re.compile(r"^\s*\}\s*,?\s*$"),
    re.compile(r"^\s*\[\s*$"),
    re.compile(r"^\s*\]\s*,?\s*$"),
    re.compile(r"^\s*\"[^\"]+\"\s*:\s*"),
    re.compile(r"^\s*\"[^\"]+\"\s*:\s*\{"),
    re.compile(r"^\s*\"[^\"]+\"\s*:\s*\["),
    re.compile(r"^\s*\"[^\"]+\"\s*:\s*\""),
    re.compile(r"^\s*\"[^\"]+\"\s*:\s*(true|false|null)"),
    re.compile(r"^\s*\"[^\"]+\"\s*:\s*-?\d"),
    re.compile(r"\btrue\b"),
    re.compile(r"\bfalse\b"),
    re.compile(r"\bnull\b"),
]

MATLAB_SIGNALS = [
    re.compile(r"^\s*%\s", re.MULTILINE),
    re.compile(r"\bzeros\s*\("),
    re.compile(r"\bones\s*\("),
    re.compile(r"\brand\s*\("),
    re.compile(r"\brandn\s*\("),
    re.compile(r"\bfigure\s*;"),
    re.compile(r"\bfigure\s*\("),
    re.compile(r"\bsubplot\s*\("),
    re.compile(r"\bplot\s*\("),
    re.compile(r"\bxlabel\s*\("),
    re.compile(r"\bylabel\s*\("),
    re.compile(r"\btitle\s*\("),
    re.compile(r"\blegend\s*\("),
    re.compile(r"\bgrid\s+(on|off)"),
    re.compile(r"\bhold\s+(on|off)"),
    re.compile(r"\baxis\s*\("),
    re.compile(r"\bxlim\s*\("),
    re.compile(r"\bylim\s*\("),
    re.compile(r"\bdisp\s*\("),
    re.compile(r"\bfprintf\s*\("),
    re.compile(r"\bsprintf\s*\("),
    re.compile(r"\binput\s*\("),
    re.compile(r"\bsave\s+\w+\."),
    re.compile(r"\bload\s+\w+\."),
    re.compile(r"\bfunction\s+\w+\s*="),
    re.compile(r"\bend\s*$", re.MULTILINE),
    re.compile(r"\bfor\s+\w+\s*="),
    re.compile(r"\bwhile\s*\("),
    re.compile(r"\bif\s*\("),
    re.compile(r"\belseif\s+"),
    re.compile(r"\bswitch\s+"),
    re.compile(r"\bcase\s+['\"]"),
    re.compile(r"\botherwise\b"),
    re.compile(r"\bbutter\s*\("),
    re.compile(r"\bfiltfilt\s*\("),
    re.compile(r"\bfft\s*\("),
    re.compile(r"\bifft\s*\("),
    re.compile(r"\bconv\s*\("),
    re.compile(r"\bsin\s*\("),
    re.compile(r"\bcos\s*\("),
    re.compile(r"\btan\s*\("),
    re.compile(r"\bexp\s*\("),
    re.compile(r"\blog\s*\("),
    re.compile(r"\bsqrt\s*\("),
    re.compile(r"\babs\s*\("),
    re.compile(r"\blength\s*\("),
    re.compile(r"\bsize\s*\("),
    re.compile(r"\breshape\s*\("),
    re.compile(r"\bcell\s*\("),
    re.compile(r"\bstruct\s*\("),
    re.compile(r"\bstrcmp\s*\("),
    re.compile(r"\bnum2str\s*\("),
    re.compile(r"\bstr2num\s*\("),
]


# Language -> signals map (for scoring)
ALL_LANGUAGE_SIGNALS = [
    {"lang": "sql", "signals": SQL_SIGNALS, "priority": 3},
    {"lang": "html", "signals": HTML_SIGNALS, "priority": 3},
    {"lang": "css", "signals": CSS_SIGNALS, "priority": 3},
    {"lang": "json", "signals": JSON_SIGNALS, "priority": 3},
    {"lang": "php", "signals": PHP_SIGNALS, "priority": 3},
    {"lang": "bash", "signals": BASH_SIGNALS, "priority": 3},
    {"lang": "matlab", "signals": MATLAB_SIGNALS, "priority": 2},
    {"lang": "go", "signals": GO_SIGNALS, "priority": 3},
    {"lang": "rust", "signals": RUST_SIGNALS, "priority": 3},
    {"lang": "kotlin", "signals": KOTLIN_SIGNALS, "priority": 2},
    {"lang": "java", "signals": JAVA_SIGNALS, "priority": 2},
    {"lang": "cpp", "signals": CPP_SIGNALS, "priority": 3},
    {"lang": "typescript", "signals": TYPESCRIPT_SIGNALS, "priority": 2},
    {"lang": "javascript", "signals": JAVASCRIPT_SIGNALS, "priority": 2},
    {"lang": "python", "signals": PYTHON_SIGNALS, "priority": 2},
    {"lang": "r", "signals": R_SIGNALS, "priority": 2},
]


def count_matches(code: str, patterns) -> int:
    """Count how many patterns in `patterns` match `code`."""
    n = 0
    for p in patterns:
        if p.search(code):
            n += 1
    return n


# ── Structural detection helpers ──

def is_json_block(code: str) -> bool:
    """Check if code is a JSON block (starts with { or [)."""
    trimmed = code.strip()
    if not trimmed:
        return False
    if not (trimmed.startswith("{") or trimmed.startswith("[")):
        return False
    if not (trimmed.endswith("}") or trimmed.endswith("]")):
        return False
    # Count JSON-specific patterns line by line (patterns use ^ anchor)
    lines = code.split("\n")
    json_hits = 0
    for line in lines:
        for p in JSON_SIGNALS:
            if p.search(line):
                json_hits += 1
                break  # one match per line is enough
    return json_hits >= 3


def is_html_block(code: str) -> bool:
    """Check if code is HTML (>=2 HTML signal hits)."""
    return count_matches(code, HTML_SIGNALS) >= 2


def is_css_block(code: str) -> bool:
    """Check if code is CSS (>=2 CSS signal hits)."""
    return count_matches(code, CSS_SIGNALS) >= 2


# ── Legacy aliases (kept for backward compatibility) ──
R_PATTERNS = R_SIGNALS

# Pattern khas SQL (untuk deteksi cepat sebelum pygments)
SQL_KEYWORDS = re.compile(
    r"\b(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|FROM|WHERE|JOIN|"
    r"GROUP\s+BY|ORDER\s+BY|HAVING|UNION|VALUES|SET|TABLE|DATABASE|INDEX|VIEW|"
    r"PROCEDURE|FUNCTION|TRIGGER|PRIMARY|FOREIGN|REFERENCES|CONSTRAINT|"
    r"DEFAULT|NOT\s+NULL|AUTO_INCREMENT|SERIAL|CASCADE)\b",
    re.IGNORECASE,
)

PHP_PATTERNS = PHP_SIGNALS
JAVA_PATTERNS = JAVA_SIGNALS


def detect_r(code: str) -> bool:
    """Deteksi apakah kode adalah R. Override pygments yang sering salah."""
    hits = sum(1 for p in R_PATTERNS if p.search(code))
    strong_r = bool(re.search(
        r"\b(cat|qt|qnorm|qf|qchisq|qlnorm|qbeta|setwd|set\.seed|sapply|lapply|vapply|mapply)\s*\(",
        code
    ))
    assign_r = bool(re.search(r"\b\w+\s*<-", code))  # <- with word boundary on left
    pipe_r = bool(re.search(r"%>%|%<>%|%<-%", code))
    lib_r = bool(re.search(r"\blibrary\s*\(", code))

    if (strong_r or pipe_r or lib_r) and assign_r:
        return True
    if assign_r and hits >= 3:
        return True
    if hits >= 4:
        return True

    # R-specific function calls (without <- assignment)
    r_strong_function = bool(re.search(
        r"\b(chisq\.test|cor\.test|t\.test|aov|glm|"
        r"data\.frame|read\.csv|read\.table|read\.xlsx|"
        r"cbind|rbind|row\.names|col\.names|row\.sums|col\.sums|"
        r"apply|sapply|lapply|vapply|mapply|"
        r"set\.seed|qt|qnorm|qf|qchisq|pt|pnorm|pf|pchisq|dt|dnorm|df|dchisq)\s*\(",
        code
    ))
    r_dollar_notation = bool(re.search(r"\b\w+\$\w+", code))
    r_string_paste = bool(re.search(r"\bpaste0?\s*\(", code))
    r_method_arg = bool(re.search(r"method\s*=\s*c\s*\(", code))

    if r_strong_function:
        return True
    if r_strong_function and (r_dollar_notation or r_string_paste or r_method_arg):
        return True
    if r_dollar_notation and (r_string_paste or r_method_arg):
        return True
    return False


def detect_sql(code: str) -> bool:
    """Deteksi SQL secara cepat (>= 2 unique SQL keywords)."""
    matches = SQL_KEYWORDS.findall(code)
    unique_keywords = set(m.upper() for m in matches)
    return len(unique_keywords) >= 2


def detect_bash(code: str) -> bool:
    """Deteksi Bash/Shell script."""
    if re.search(r"^#!\s*/(?:usr/)?bin/(?:bash|sh|zsh|ksh)", code, re.MULTILINE):
        return True
    bash_patterns = [
        re.compile(r"\b(if|then|fi|for|do|done|while|case|esac)\b"),
        re.compile(r"\$\{\w+\}"),
        re.compile(r"\$\(\([^)]+\)\)"),
        re.compile(r"^\s*(?:export|alias|source|chmod|chown|cd|mkdir|rm|cp|mv)\s", re.MULTILINE),
    ]
    hits = sum(1 for p in bash_patterns if p.search(code))
    return hits >= 2


def detect_php(code: str) -> bool:
    """Deteksi PHP. Tapi jangan salah anggap Bash sebagai PHP."""
    if detect_bash(code):
        return False
    php_hits = sum(1 for p in PHP_PATTERNS if p.search(code))
    return php_hits >= 2 or bool(PHP_PATTERNS[0].search(code))


def detect_java(code: str) -> bool:
    """Deteksi Java (bukan C++)."""
    java_hits = sum(1 for p in JAVA_PATTERNS if p.search(code))
    has_cpp_marker = bool(re.search(r"#include\s*[<\"]", code)) or "std::" in code
    return java_hits >= 2 and not has_cpp_marker


def detect_ruby(code: str) -> bool:
    """Deteksi Ruby — def...end pattern."""
    if re.search(r"^\s*def\s+\w+", code, re.MULTILINE) and \
       re.search(r"^\s*end\s*$", code, re.MULTILINE):
        return True
    if re.search(r"\bputs\s+", code) and re.search(r"#\{\w+\}", code):
        return True
    return False


def detect_language(code: str) -> str:
    """Deteksi bahasa dari string kode.

    Strategi (UPGRADED to parity with TS version):
    1. PHP `<?php` tag fast-path (before HTML — PHP embeds HTML).
    2. Bash shebang fast-path.
    3. TypeScript type-annotation check.
    4. Structural detection (JSON/HTML/CSS).
    5. Custom detection helpers (R/SQL/Bash/PHP/Java/Ruby).
    6. Priority chain of distinctive keywords.
    7. Score each language's signal array.
    8. pygments as last resort.

    Returns:
        string bahasa (lowercase): "python", "r", "javascript", "typescript",
        "java", "cpp", "c", "sql", "kotlin", "php", "ruby", "go", "rust",
        "swift", "scala", "bash", "shell", "html", "css", "json", "yaml",
        "markdown", "matlab", atau "unknown"
    """
    if not code or len(code.strip()) < 10:
        return "unknown"

    # 1. Fast path: PHP detection (must check BEFORE HTML because PHP embeds HTML)
    if re.search(r"<\?php|<\?=", code):
        return "php"

    # 2. Fast path: Bash shebang — very strong signal
    if re.search(r"^#!\/(bin|usr)\/(bash|sh|zsh)", code, re.MULTILINE):
        return "bash"

    # 3. TypeScript detection — must check BEFORE HTML because TSX has HTML tags
    has_ts_types = bool(re.search(
        r":\s*(string|number|boolean|void|any|unknown|never|Record|Array|"
        r"Partial|Readonly|Pick|Omit|Promise|ReadonlyArray|Map|Set)\b", code
    )) or bool(re.search(r"\binterface\s+\w+\s*[{<]", code)) or \
        bool(re.search(r"\btype\s+\w+\s*=", code)) or \
        bool(re.search(r"\bas\s+(const|unknown|any|string|number|boolean|Record|Array)\b", code)) or \
        bool(re.search(r"<\w+,\s*\w+>\s*=", code))
    ts_hits = count_matches(code, TYPESCRIPT_SIGNALS)
    if has_ts_types and ts_hits > 0:
        return "typescript"

    # 4. Structural detection (JSON/HTML/CSS) — after TypeScript check
    if is_json_block(code):
        return "json"
    if is_html_block(code):
        # Could be HTML with embedded CSS/JS — check ratios
        css_hits = count_matches(code, CSS_SIGNALS)
        js_hits = count_matches(code, JAVASCRIPT_SIGNALS)
        html_hits = count_matches(code, HTML_SIGNALS)
        if html_hits >= css_hits and html_hits >= js_hits:
            return "html"
    if is_css_block(code):
        html_hits = count_matches(code, HTML_SIGNALS)
        css_hits = count_matches(code, CSS_SIGNALS)
        if css_hits > html_hits:
            return "css"

    # ── Custom detection helpers (ported from Python original) ──
    # 5. R detection — strong patterns
    if detect_r(code):
        return "r"
    # 6. SQL detection — 2+ unique SQL keywords
    if detect_sql(code):
        return "sql"
    # 7. Bash detection — shebang + bash keywords
    if detect_bash(code):
        return "bash"
    # 8. PHP detection — must come before bash (PHP can have shell-like patterns)
    if detect_php(code):
        return "php"
    # 9. Java detection (distinguish from C++)
    if detect_java(code):
        return "java"
    # 10. Ruby detection — def...end pattern
    if detect_ruby(code):
        return "ruby"
    # 11. Go — package + func
    if re.search(r"^\s*package\s+\w+\s*$", code, re.MULTILINE) or \
       (re.search(r"\bfunc\s+\w+\s*\(", code) and re.search(r"\bpackage\s+\w+", code)):
        return "go"
    # 12. Rust — fn + let mut or println!
    if (re.search(r"\bfn\s+\w+\s*\(", code) and
        re.search(r"\blet\s+mut\s+\w+|println!", code)):
        return "rust"
    if "println!" in code or "pub fn " in code:
        return "rust"
    # 13. Kotlin — fun + listOf/arrayOf/when (must be before Python `def`)
    if re.search(r"\bfun\s+\w+\s*\(", code):
        return "kotlin"
    if re.search(r"\bval\s+\w+\s*[=:]", code) and \
       re.search(r"\blistOf\(|\barrayOf\(|\bmutableListOf\(|\bsetOf\(|\bmapOf\(", code):
        return "kotlin"
    if re.search(r"\bwhen\s*\(", code):
        return "kotlin"
    # 14. TypeScript — type annotations
    if re.search(r":\s*(string|number|boolean|any|void|never|unknown)\b", code):
        return "typescript"
    if re.search(r"\binterface\s+\w+\s*\{", code):
        return "typescript"
    if re.search(r"\btype\s+\w+\s*=", code) and \
       re.search(r"\b(string|number|boolean|any)\b", code):
        return "typescript"
    # Generic type usage like `Map<K,V>` or `Array<T>` — but NOT C++ `vector<T>`
    if re.search(r"\b(Array|Map|Set|Promise|Record|Partial|Readonly|Pick|Omit)<[^>]+>", code):
        return "typescript"
    if re.search(r"function\s+\w+\s*\([^)]*\)\s*:\s*\w+", code):
        return "typescript"
    if re.search(r"const\s+\w+\s*:\s*\w+\s*=", code):
        return "typescript"
    # 15. C++ — #include or std::
    if re.search(r"#include\s*[<\"]", code) or "std::" in code:
        return "cpp"
    if re.search(r"\bcout\s*<<|\bcin\s*>>", code):
        return "cpp"
    # 16. C — int main() without std::
    if re.search(r"\bint\s+main\s*\([^)]*\)\s*\{", code) and \
       "std::" not in code and "#include" not in code:
        return "c"
    # 17. Python — def, import, from, class with colon
    if re.search(r"^\s*def\s+\w+\s*\([^)]*\)\s*:", code, re.MULTILINE):
        return "python"
    if re.search(r"^\s*(import\s+\w+|from\s+\w+\s+import\s+)", code, re.MULTILINE):
        return "python"
    if re.search(r"\bprint\s*\(", code) and \
       not re.search(r"\bSystem\.out|\bconsole\.log|\bcout\s*<<", code):
        if not re.search(r"<-|library\(", code):
            return "python"
    # 18. JavaScript — const, let, var, function, console.log
    if re.search(r"\bconsole\.log\s*\(", code):
        return "javascript"
    if re.search(r"^\s*(?:const|let|var)\s+\w+\s*=", code, re.MULTILINE):
        return "javascript"
    if re.search(r"^\s*function\s+\w+\s*\(", code, re.MULTILINE):
        return "javascript"
    if re.search(r"=>\s*[\({\w]", code):
        return "javascript"

    # Score each language
    scores = []
    for entry in ALL_LANGUAGE_SIGNALS:
        lang = entry["lang"]
        signals = entry["signals"]
        priority = entry["priority"]
        # Skip structural languages already handled above
        if lang in ("json", "html", "css", "typescript"):
            continue
        hits = count_matches(code, signals)
        if hits > 0:
            scores.append({"lang": lang, "score": hits * priority})

    scores.sort(key=lambda s: s["score"], reverse=True)

    if not scores:
        # Fallback: check for R-specific patterns
        if "<-" in code:
            return "r"
        if re.search(r"\blibrary\s*\(", code):
            return "r"
        return "unknown"

    # If no TS-specific types, remove TS from scores (it was only matching JS patterns)
    filtered_scores = [s for s in scores if s["lang"] != "typescript"]

    # ── HIGH PRIORITY: language-specific distinctive keywords ──
    # Rust: `fn `, `let mut`, `pub fn`, `use std::`, `println!`, `impl `
    if re.search(r"\bfn\s+\w+", code) or re.search(r"\blet\s+mut\s+", code) or \
       re.search(r"\bpub\s+fn\s+", code) or re.search(r"\bprintln!\s*\(", code) or \
       re.search(r"\bimpl\s+\w+", code) or re.search(r"\buse\s+std::", code):
        return "rust"

    # Go: `func `, `package main`, `:=`, `fmt.`, `err != nil`
    if re.search(r"\bfunc\s+\w+\s*\(", code) or re.search(r"\bpackage\s+main\b", code) or \
       ":=" in code or re.search(r"\bfmt\.\w+", code) or \
       re.search(r"\berr\s*!=\s*nil", code):
        return "go"

    # Kotlin: `fun `, `val `, `companion object`, `lateinit`, `override fun`
    if re.search(r"\bfun\s+\w+\s*\(", code) or re.search(r"\bval\s+\w+", code) or \
       re.search(r"\bcompanion\s+object", code) or re.search(r"\blateinit\s+", code) or \
       re.search(r"\boverride\s+fun\s+", code):
        return "kotlin"

    # C++: `#include`, `std::`, `cout <<`, `using namespace`
    if re.search(r"#include\s+[<\"]", code) or "std::" in code or \
       re.search(r"\bcout\s*<<", code) or re.search(r"\busing\s+namespace\s+", code) or \
       re.search(r"\btemplate\s*<", code):
        return "cpp"

    # Java: `System.out.`, `public class`, `import java.`
    if re.search(r"\bSystem\.(out|err)\.", code) or re.search(r"\bimport\s+java\.", code) or \
       re.search(r"\bpublic\s+class\s+\w+", code):
        return "java"

    # Python: `def `, `import `, `from X import`, `self.`, `print(`, `__init__`
    if re.search(r"\bdef\s+\w+\s*\(", code) or re.search(r"\bfrom\s+\w+\s+import", code) or \
       re.search(r"\bclass\s+\w+.*:\s*$", code, re.MULTILINE) or \
       re.search(r"\bself\.\w+", code) or re.search(r"\b__init__\s*\(", code) or \
       re.search(r"\b__name__", code) or \
       re.search(r"\bimport\s+(pandas|numpy|matplotlib|scipy|sklearn|tensorflow|torch)\b", code) or \
       re.search(r"\.\bappend\s*\(", code) or re.search(r"\.\bextend\s*\(", code) or \
       re.search(r"\bplt\.\w+", code) or re.search(r"\bpd\.\w+", code) or \
       re.search(r"\bnp\.\w+", code):
        return "python"

    # R: `<-`, `library(`, `data.frame(`
    if "<-" in code or re.search(r"\blibrary\s*\(", code) or \
       re.search(r"\bdata\.frame\s*\(", code):
        return "r"

    # Special case: C++ vs Java (already handled above, but fallback)
    cpp_score = next((s["score"] for s in filtered_scores if s["lang"] == "cpp"), 0)
    java_score = next((s["score"] for s in filtered_scores if s["lang"] == "java"), 0)
    if cpp_score > 0 and cpp_score >= java_score:
        return "cpp"

    # Special case: Kotlin vs Java
    kotlin_score = next((s["score"] for s in filtered_scores if s["lang"] == "kotlin"), 0)
    if kotlin_score > 0 and kotlin_score >= java_score:
        return "kotlin"

    if not filtered_scores:
        # 19. pygments as last resort (unreliable for short snippets, but might catch some)
        try:
            lexer = guess_lexer(code)
            aliases = getattr(lexer, "aliases", [])
            alias_to_lang = {
                "python": "python", "python2": "python", "python3": "python",
                "py": "python",
                "r": "r", "rconsole": "r",
                "javascript": "javascript", "js": "javascript",
                "typescript": "typescript", "ts": "typescript",
                "cpp": "cpp", "c++": "cpp", "cxx": "cpp",
                "c": "c",
                "java": "java",
                "kotlin": "kotlin",
                "sql": "sql", "mysql": "sql", "postgresql": "sql",
                "php": "php",
                "ruby": "ruby", "rb": "ruby",
                "go": "go", "golang": "go",
                "rust": "rust",
                "swift": "swift",
                "scala": "scala",
                "bash": "bash", "sh": "bash", "shell": "bash",
                "html": "html",
                "css": "css",
                "json": "json",
                "yaml": "yaml",
                "markdown": "markdown",
                "matlab": "matlab",
                "arduino": "cpp",  # treat as cpp
                "text": "unknown", "plaintext": "unknown",
            }
            for alias in aliases:
                if alias.lower() in alias_to_lang:
                    lang = alias_to_lang[alias.lower()]
                    if lang != "unknown":
                        return lang
        except (ClassNotFound, Exception):
            pass
        return "unknown"

    return filtered_scores[0]["lang"]


def detect_languages_for_blocks(blocks: list[dict]) -> list[dict]:
    """Deteksi bahasa untuk list of code blocks (in-place).

    Args:
        blocks: list of dict dengan key "code" (string)

    Returns:
        list of dict dengan key "lang" ditambahkan/updated
    """
    for block in blocks:
        if "code" not in block:
            continue
        # Kalau sudah ada lang dan bukan "unknown", pertahankan
        if block.get("lang") and block["lang"] != "unknown":
            continue
        block["lang"] = detect_language(block["code"])
    return blocks
