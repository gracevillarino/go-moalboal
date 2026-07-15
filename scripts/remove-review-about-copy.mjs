import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const directory = path.resolve('src/content/businesses');
const files = (await readdir(directory)).filter((file) => file.endsWith('.json'));
let updated = 0;

for (const file of files) {
  const filePath = path.join(directory, file);
  const business = JSON.parse(await readFile(filePath, 'utf8'));
  const description = business.description
    .split(/\n\n+/)
    .slice(0, 2)
    .map((paragraph) => paragraph
      .split(/(?<=[.!?])\s+/)
      .filter((sentence) => !/\bGoogle rating\b|\bGoogle reviews?\b|\breviews?\b|\bvisitor feedback\b/i.test(sentence))
      .join(' '))
    .filter(Boolean)
    .join('\n\n');
  if (description === business.description) continue;
  business.description = description;
  await writeFile(filePath, `${JSON.stringify(business, null, 2)}\n`);
  updated += 1;
}

console.log(`Removed review-derived About copy from ${updated} listings.`);
