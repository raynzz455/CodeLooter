/**
 * LLM-based language classification for code blocks.
 *
 * Usage: node llm_classify.js <json_array_of_code_blocks>
 * Input: JSON array of strings (code blocks)
 * Output: JSON array of {code, lang} to stdout
 *
 * Example:
 *   echo '["library(lmtest)\nsummary(vp)", "print(\"hello\")"]' | node llm_classify.js
 *   Output: [{"code":"library...","lang":"r"},{"code":"print...","lang":"python"}]
 */
import ZAI from 'z-ai-web-dev-sdk';

async function main() {
  // Read code blocks from stdin or command arg
  const input = process.argv[2] || await readStdin();
  if (!input) {
    console.error('No input provided');
    process.exit(1);
  }

  let blocks;
  try {
    blocks = JSON.parse(input);
  } catch (e) {
    console.error('Invalid JSON input:', e.message);
    process.exit(1);
  }

  if (!Array.isArray(blocks) || blocks.length === 0) {
    console.log('[]');
    return;
  }

  // Initialize z-ai SDK
  const zai = await ZAI.create();

  // Build prompt: classify all blocks in one request (efficient)
  const blocksText = blocks.map((code, i) => `---BLOCK ${i}---\n${code.substring(0, 500)}`).join('\n\n');

  const prompt = `You are a programming language classifier. For each code block below, reply with ONLY the language name in lowercase. Valid languages: python, r, javascript, typescript, java, cpp, c, sql, kotlin, php, ruby, go, rust, swift, scala, bash, html, css, json, unknown.

Reply as a JSON array of strings, one per block, in order. Example: ["r","python","sql"]

Code blocks:

${blocksText}`;

  try {
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'user', content: prompt }
      ],
      thinking: { type: 'disabled' }
    });

    let response = completion.choices[0]?.message?.content || '';

    // Parse LLM response — try to extract JSON array
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const langs = JSON.parse(jsonMatch[0]);
      // Map back to blocks
      const result = blocks.map((code, i) => ({
        code: code,
        lang: langs[i] || 'unknown'
      }));
      console.log(JSON.stringify(result));
    } else {
      // Fallback: split response by lines/newlines
      const langs = response.trim().split(/[\n,\s]+/).filter(s => s);
      const result = blocks.map((code, i) => ({
        code: code,
        lang: langs[i]?.toLowerCase() || 'unknown'
      }));
      console.log(JSON.stringify(result));
    }
  } catch (e) {
    console.error('LLM error:', e.message);
    // Fallback: return all as "unknown"
    const result = blocks.map(code => ({ code, lang: 'unknown' }));
    console.log(JSON.stringify(result));
  }
}

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => resolve(data.trim()));
  });
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
