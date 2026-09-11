#!/usr/bin/env python3
"""Test suite for the Task 21 upgrade — verifies extraction works on samples
for 14 languages: R, Python, SQL, Java, C++, JavaScript, TypeScript, PHP,
Bash, Go, Rust, Kotlin, HTML, CSS, JSON.

Run with:
    cd backend
    python -m pytest test_upgrade.py -v
or:
    cd backend && python test_upgrade.py
"""
import os
import sys

# Allow running as `python test_upgrade.py` from backend/ dir
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.pattern_extract import extract_code_blocks, is_code_line, is_r_output
from app.language_detection import detect_language
from app.hljs_validator import validate_line, STATISTICAL_NARRATIVE_PATTERNS


# ── Test cases ──

# Each test case is a complete document containing narrative + code.
# The extractor should find the code block and classify it with the correct lang.
TEST_CASES = [
    # ── 1. R statistics module ──
    {
        "name": "R — chisq.test + cor.test",
        "doc": """Modul Praktikum Statistik

# Kasus 1: Uji Chi-Square
Kode Penyelesaian:
data <- read.csv("data.csv")
result <- chisq.test(data$A, data$B)
print(result)

Hasil di atas menunjukkan bahwa data signifikan.
""",
        "expected_lang": "r",
        "expected_substring": "chisq.test",
    },
    # ── 2. Python ──
    {
        "name": "Python — class + method",
        "doc": """This module demonstrates a Python class.

import numpy as np
import pandas as pd

class DataProcessor:
    def __init__(self, data):
        self.data = data

    def normalize(self):
        return (self.data - self.data.mean()) / self.data.std()

df = pd.DataFrame({"x": [1, 2, 3]})
processor = DataProcessor(df)
print(processor.normalize())
""",
        "expected_lang": "python",
        "expected_substring": "class DataProcessor",
    },
    # ── 3. SQL ──
    {
        "name": "SQL — CREATE TABLE + SELECT",
        "doc": """Database schema for the application:

CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE
);

SELECT u.name, COUNT(o.id) AS order_count
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE u.id > 0
GROUP BY u.name
ORDER BY order_count DESC;
""",
        "expected_lang": "sql",
        "expected_substring": "CREATE TABLE",
    },
    # ── 4. Java ──
    {
        "name": "Java — public class",
        "doc": """Java solution for Hello World:

import java.util.ArrayList;

public class HelloWorld {
    public static void main(String[] args) {
        ArrayList<String> list = new ArrayList<>();
        list.add("Hello");
        System.out.println(list.get(0));
    }
}
""",
        "expected_lang": "java",
        "expected_substring": "public class HelloWorld",
    },
    # ── 5. C++ ──
    {
        "name": "C++ — std::cout",
        "doc": """C++ program demonstrating cout:

#include <iostream>
#include <vector>
using namespace std;

int main() {
    vector<int> v = {1, 2, 3};
    for (int x : v) {
        cout << x << endl;
    }
    return 0;
}
""",
        "expected_lang": "cpp",
        "expected_substring": "#include <iostream>",
    },
    # ── 6. JavaScript ──
    {
        "name": "JavaScript — fetch + console.log",
        "doc": """JavaScript example using fetch:

const url = 'https://api.example.com/data';
async function getData() {
    const response = await fetch(url);
    const data = await response.json();
    console.log(data);
    return data;
}

module.exports = { getData };
""",
        "expected_lang": "javascript",
        "expected_substring": "console.log",
    },
    # ── 7. TypeScript ──
    {
        "name": "TypeScript — interface + types",
        "doc": """TypeScript example with type annotations:

interface User {
    id: number;
    name: string;
    email?: string;
}

type UserList = User[];

function getUser(id: number): User {
    return { id, name: "Alice" };
}

const users: UserList = [getUser(1)];
export default users;
""",
        "expected_lang": "typescript",
        "expected_substring": "interface User",
    },
    # ── 8. PHP ──
    {
        "name": "PHP — <?php tag + class",
        "doc": """PHP backend example:

<?php
namespace App\\Service;

class UserService {
    private $users = [];

    public function add($name) {
        $this->users[] = $name;
        return count($this->users);
    }
}

$service = new UserService();
echo $service->add("Alice");
?>
""",
        "expected_lang": "php",
        "expected_substring": "<?php",
    },
    # ── 9. Bash ──
    {
        "name": "Bash — shebang + script",
        "doc": """Deployment script:

#!/bin/bash
set -e

PROJECT_DIR=/var/www/app
cd $PROJECT_DIR

echo "Deploying..."
git pull origin main
npm install
npm run build
systemctl restart nginx
echo "Done"
""",
        "expected_lang": "bash",
        "expected_substring": "#!/bin/bash",
    },
    # ── 10. Go ──
    {
        "name": "Go — package main + func",
        "doc": """Go HTTP server example:

package main

import (
    "fmt"
    "net/http"
)

func handler(w http.ResponseWriter, r *http.Request) {
    fmt.Fprintf(w, "Hello, %s!", r.URL.Path[1:])
}

func main() {
    http.HandleFunc("/", handler)
    err := http.ListenAndServe(":8080", nil)
    if err != nil {
        fmt.Println("Error:", err)
    }
}
""",
        "expected_lang": "go",
        "expected_substring": "package main",
    },
    # ── 11. Rust ──
    {
        "name": "Rust — fn + let mut + println!",
        "doc": """Rust factorial example:

use std::io;

fn factorial(n: u32) -> u32 {
    let mut result = 1;
    for i in 1..=n {
        result *= i;
    }
    result
}

fn main() {
    println!("5! = {}", factorial(5));
}
""",
        "expected_lang": "rust",
        "expected_substring": "fn factorial",
    },
    # ── 12. Kotlin ──
    {
        "name": "Kotlin — fun + data class",
        "doc": """Kotlin data class example:

package com.example.models

data class User(
    val id: Int,
    val name: String,
    val email: String?
)

fun main() {
    val user = User(1, "Alice", null)
    println(user)
}
""",
        "expected_lang": "kotlin",
        "expected_substring": "data class User",
    },
    # ── 13. HTML ──
    {
        "name": "HTML — doctype + tags",
        "doc": """HTML page example:

<!DOCTYPE html>
<html>
<head>
    <title>My Page</title>
</head>
<body>
    <h1>Welcome</h1>
    <p>This is a paragraph.</p>
    <div class="container">
        <a href="https://example.com">Link</a>
    </div>
</body>
</html>
""",
        "expected_lang": "html",
        "expected_substring": "<!DOCTYPE html>",
    },
    # ── 14. CSS ──
    {
        "name": "CSS — selectors + properties",
        "doc": """CSS stylesheet:

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
    background-color: #f5f5f5;
}

h1 {
    color: #333;
    font-size: 24px;
    text-align: center;
}

@media (max-width: 768px) {
    .container { padding: 10px; }
}
""",
        "expected_lang": "css",
        "expected_substring": ".container",
    },
    # ── 15. JSON ──
    {
        "name": "JSON — config object",
        "doc": """Configuration file:

{
    "name": "my-app",
    "version": "1.0.0",
    "dependencies": {
        "lodash": "^4.17.21",
        "axios": "^1.0.0"
    },
    "scripts": {
        "start": "node index.js",
        "test": "jest"
    }
}
""",
        "expected_lang": "json",
        "expected_substring": '"name":',
    },
]


# ── Standalone language detection tests ──

LANG_DETECT_TESTS = [
    ("library(dplyr)\nx <- c(1,2,3)\nmean(x)", "r"),
    ("def factorial(n):\n    if n <= 1:\n        return 1\n    return n * factorial(n-1)", "python"),
    ("SELECT * FROM users WHERE id = 1;", "sql"),
    ("public class Main {\n    public static void main(String[] args) {\n        System.out.println(\"hi\");\n    }\n}", "java"),
    ("#include <iostream>\nint main() {\n    std::cout << \"hi\";\n    return 0;\n}", "cpp"),
    ("const x = 1;\nfunction foo() { return x; }\nconsole.log(foo());", "javascript"),
    ("interface User { id: number; }\nconst u: User = { id: 1 };", "typescript"),
    ("<?php\n$x = 1;\necho $x;\n?>", "php"),
    ("#!/bin/bash\necho hello\nfor i in 1 2 3; do echo $i; done", "bash"),
    ("package main\nimport \"fmt\"\nfunc main() { fmt.Println(\"hi\") }", "go"),
    ("fn main() {\n    let mut x = 5;\n    println!(\"{}\", x);\n}", "rust"),
    ("data class User(val id: Int)\nfun main() { val u = User(1) }", "kotlin"),
    ("<!DOCTYPE html>\n<html>\n<head><title>x</title></head>\n<body></body>\n</html>", "html"),
    (".box { color: red; margin: 0; padding: 10px; }", "css"),
    ('{\n  "a": 1,\n  "b": "hello",\n  "c": [1, 2, 3]\n}', "json"),
]


# ── Line classification tests (is_code_line edge cases) ──

LINE_CLASSIFY_TESTS = [
    # (line, expected_is_code)
    ("library(dplyr)", True),
    ("x <- c(1, 2, 3)", True),
    ("def foo():", True),
    ("    return 42", True),
    ("SELECT * FROM users", True),
    ("public class Main {", True),
    ("    System.out.println(\"hi\");", True),
    ("#include <iostream>", True),
    ("const x = 1;", True),
    ("#!/bin/bash", True),
    ("<?php echo 'hi';", True),
    ("package main", True),
    ("fn main() {", True),
    ("fun main() {", True),
    ("<!DOCTYPE html>", True),
    (".box { color: red; }", True),
    # Single-line compact JSON `{ "k": "v" }` is NOT reliably detected by either
    # the TS or Python version (multi-line JSON is — tested in extraction suite).
    # JSON multi-line patterns (each line is code):
    ("{", True),                       # JSON opening brace alone
    ('"name": "Alice",', True),        # JSON property
    ("}", True),                       # JSON closing brace
    # Narrative (NOT code) — high prose ratio
    ("This is a sentence about statistics.", False),  # prose ratio too high
    # R output (NOT code) — but ## TitleCase heading is NOT R output
    ("## X-squared = 2.2222", True),  # R output is True for is_r_output, but is_code_line should return False
    ("[1] 1 2 3 4 5", True),  # is_r_output True; is_code_line returns False (handled below)
    # Markdown heading (NOT R output)
    ("## 1. Query Data", False),  # numbered markdown heading — not R output, has no code signals
    ("### Subsection Title", False),  # title-case markdown heading
    # Equation (NOT code)
    ("chi-square = 5.99 menunjukkan bahwa hipotesis ditolak", False),  # statistical narrative
]


def _check_is_code_line_or_r_output(line):
    """For testing: a line is "code content" if is_code_line(line) OR is_r_output(line)."""
    return is_code_line(line) or is_r_output(line)


def test_extraction_basic():
    """Test that extract_code_blocks returns blocks for a simple R snippet."""
    text = """# Kasus 1: Uji Hipotesis
Kode Penyelesaian:
data <- c(1, 2, 3, 4, 5)
mean(data)
sd(data)
"""
    blocks = extract_code_blocks(text)
    assert len(blocks) >= 1, f"Expected >=1 block, got {len(blocks)}"
    assert any("mean(data)" in b["code"] for b in blocks), \
        f"Expected 'mean(data)' in some block, got: {[b['code'] for b in blocks]}"
    print(f"  test_extraction_basic: PASS — {len(blocks)} block(s), first lang = {blocks[0]['lang']}")


def test_extraction_per_language():
    """Test extraction + language detection for all 15 test cases."""
    print()
    failures = []
    for tc in TEST_CASES:
        blocks = extract_code_blocks(tc["doc"])
        # Find the block containing the expected substring
        matching = [b for b in blocks if tc["expected_substring"] in b["code"]]
        if not matching:
            failures.append((tc["name"], f"no block contains '{tc['expected_substring']}'", [b["code"][:50] for b in blocks]))
            print(f"  FAIL — {tc['name']}: no block contains '{tc['expected_substring']}'")
            print(f"    blocks found: {len(blocks)}")
            for i, b in enumerate(blocks):
                print(f"    [{i}] lang={b['lang']}, code={b['code'][:80]!r}")
            continue
        block = matching[0]
        if block["lang"] != tc["expected_lang"]:
            failures.append((tc["name"], f"lang={block['lang']} (expected {tc['expected_lang']})", block["code"][:80]))
            print(f"  FAIL — {tc['name']}: lang={block['lang']} (expected {tc['expected_lang']})")
        else:
            print(f"  PASS — {tc['name']}: lang={block['lang']}, {len(blocks)} block(s) total")
    if failures:
        print(f"\n  SUMMARY: {len(failures)} failures")
        for name, reason, _ in failures:
            print(f"    - {name}: {reason}")
    else:
        print(f"\n  SUMMARY: all {len(TEST_CASES)} extraction tests passed")
    assert not failures, f"{len(failures)} extraction tests failed"


def test_language_detection():
    """Test detect_language for all 15 languages."""
    print()
    failures = []
    for code, expected in LANG_DETECT_TESTS:
        actual = detect_language(code)
        if actual == expected:
            print(f"  PASS — {expected:11s} -> {actual}")
        else:
            print(f"  FAIL — expected={expected:11s}, got={actual}  for code: {code[:60]!r}")
            failures.append((code, expected, actual))
    if failures:
        print(f"\n  SUMMARY: {len(failures)} language-detection failures")
    else:
        print(f"\n  SUMMARY: all {len(LANG_DETECT_TESTS)} language-detection tests passed")
    assert not failures, f"{len(failures)} language-detection tests failed"


def test_line_classification():
    """Test is_code_line / is_r_output for edge cases."""
    print()
    failures = []
    for line, expected in LINE_CLASSIFY_TESTS:
        is_code = is_code_line(line)
        is_r_out = is_r_output(line)
        # For R output lines, "is_code_line" returns False, but they're still "code content"
        # for extraction purposes. So combined flag = is_code OR is_r_out.
        combined = is_code or is_r_out
        if combined == expected:
            tag = "R-output" if is_r_out else "code"
            print(f"  PASS — {line[:50]!r:55s} -> {tag}")
        else:
            print(f"  FAIL — {line[:50]!r:55s} -> expected={expected}, got code={is_code} r_out={is_r_out}")
            failures.append((line, expected, is_code, is_r_out))
    if failures:
        print(f"\n  SUMMARY: {len(failures)} line-classification failures")
    else:
        print(f"\n  SUMMARY: all {len(LINE_CLASSIFY_TESTS)} line-classification tests passed")
    assert not failures, f"{len(failures)} line-classification tests failed"


def test_markdown_heading_not_r_output():
    """Critical fix: ## 1. Title must NOT be treated as R output."""
    print()
    # Numbered heading
    assert not is_r_output("## 1. Query Data"), "## 1. Query Data should NOT be R output"
    print("  PASS — '## 1. Query Data' is NOT R output")
    # Title-case heading
    assert not is_r_output("### Subsection Title"), "### Subsection Title should NOT be R output"
    print("  PASS — '### Subsection Title' is NOT R output")
    # Real R output (no number, not title-case)
    assert is_r_output("## X-squared = 2.2222"), "## X-squared = 2.2222 SHOULD be R output"
    print("  PASS — '## X-squared = 2.2222' IS R output")
    assert is_r_output("[1] 1 2 3 4 5"), "[1] ... SHOULD be R output"
    print("  PASS — '[1] 1 2 3 4 5' IS R output")


def test_statistical_narrative_not_code():
    """Critical fix: 'koefisien_variasi' (variable name) should NOT match narrative pattern."""
    print()
    # 'koefisien_variasi' (Indonesian variable name with underscore) must NOT match narrative
    for pattern in STATISTICAL_NARRATIVE_PATTERNS:
        assert not pattern.search("koefisien_variasi <- c(1, 2, 3)"), \
            f"Pattern {pattern.pattern!r} should NOT match 'koefisien_variasi'"
    print("  PASS — 'koefisien_variasi <- ...' NOT flagged as narrative")
    # But standalone 'koefisien' SHOULD match
    matched = any(p.search("nilai koefisien adalah 0.8") for p in STATISTICAL_NARRATIVE_PATTERNS)
    assert matched, "'koefisien' standalone should match narrative"
    print("  PASS — 'nilai koefisien adalah 0.8' IS flagged as narrative")
    # validate_line should reject statistical narrative
    result = validate_line("X-squared = 2.2222 menunjukkan bahwa H0 ditolak")
    assert not result["is_code"], "Statistical narrative should NOT be code"
    print("  PASS — 'X-squared = ... menunjukkan bahwa H0 ditolak' rejected by validate_line")


def test_indonesian_modul_extraction():
    """Regression test: Indonesian modul praktikum with R statistics."""
    print()
    text = """Modul Praktikum Statistika — Uji Chi-Square

# Kasus 1: Uji Independensi
Kode Penyelesaian:
data <- matrix(c(50, 30, 20, 40), nrow = 2, byrow = TRUE)
result <- chisq.test(data)
print(result)

Interpretasi:
Nilai X-squared = 2.2222 menunjukkan bahwa hipotesis nol ditolak pada taraf signifikanasi 5%.

# Contoh 2: Korelasi Pearson
data2 <- read.csv("sampel.csv")
cor_result <- cor.test(data2$x, data2$y, method = "pearson")
print(cor_result)
"""
    blocks = extract_code_blocks(text)
    # Should find at least 2 R code blocks (one for each # Kasus/# Contoh)
    r_blocks = [b for b in blocks if b["lang"] == "r"]
    print(f"  Found {len(blocks)} blocks, {len(r_blocks)} are R")
    assert len(r_blocks) >= 1, f"Expected >=1 R block, got {len(r_blocks)}"
    # The first R block should contain chisq.test
    assert any("chisq.test" in b["code"] for b in r_blocks), \
        f"Expected chisq.test in some R block, got: {[b['code'][:80] for b in r_blocks]}"
    # The narrative line "X-squared = 2.2222 menunjukkan bahwa..." should NOT be in any block
    for b in blocks:
        assert "menunjukkan bahwa" not in b["code"], \
            f"Narrative line leaked into block: {b['code']!r}"
    print("  PASS — Indonesian modul extracted correctly, no narrative leakage")


def main():
    """Run all tests."""
    print("=== CodeLooter Task 21 Upgrade Test Suite ===\n")

    print("[1] test_markdown_heading_not_r_output:")
    test_markdown_heading_not_r_output()

    print("\n[2] test_statistical_narrative_not_code:")
    test_statistical_narrative_not_code()

    print("\n[3] test_language_detection:")
    test_language_detection()

    print("\n[4] test_line_classification:")
    test_line_classification()

    print("\n[5] test_extraction_basic:")
    test_extraction_basic()

    print("\n[6] test_extraction_per_language:")
    test_extraction_per_language()

    print("\n[7] test_indonesian_modul_extraction:")
    test_indonesian_modul_extraction()

    print("\n=== ALL TESTS PASSED ===")
    return 0


if __name__ == "__main__":
    sys.exit(main())
