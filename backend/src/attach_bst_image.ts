import prisma from './lib/prisma';

async function main() {
  const problem = await prisma.problem.findFirst({
    where: {
      OR: [
        { title: { contains: 'Validate Binary Search Tree', mode: 'insensitive' } },
        { slug: { contains: 'validate-binary-search-tree', mode: 'insensitive' } }
      ]
    }
  });

  if (!problem) {
    console.log('Problem not found');
    return;
  }

  const rawSvg1 = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="150" viewBox="0 0 240 150"><style>text{font-family:sans-serif;font-weight:bold;fill:#ffffff;font-size:14px;text-anchor:middle;dominant-baseline:central;}</style><line x1="120" y1="35" x2="60" y2="95" stroke="#3b82f6" stroke-width="3"/><line x1="120" y1="35" x2="180" y2="95" stroke="#3b82f6" stroke-width="3"/><circle cx="120" cy="35" r="20" fill="#1e293b" stroke="#3b82f6" stroke-width="3"/><text x="120" y="35">2</text><circle cx="60" cy="95" r="20" fill="#1e293b" stroke="#10b981" stroke-width="3"/><text x="60" y="95">1</text><circle cx="180" cy="95" r="20" fill="#1e293b" stroke="#10b981" stroke-width="3"/><text x="180" y="95">3</text></svg>`;

  const rawSvg2 = `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="170" viewBox="0 0 280 170"><style>text{font-family:sans-serif;font-weight:bold;fill:#ffffff;font-size:14px;text-anchor:middle;dominant-baseline:central;}</style><line x1="140" y1="30" x2="70" y2="90" stroke="#3b82f6" stroke-width="3"/><line x1="140" y1="30" x2="210" y2="90" stroke="#ef4444" stroke-width="3"/><line x1="210" y1="90" x2="170" y2="140" stroke="#ef4444" stroke-width="3"/><line x1="210" y1="90" x2="250" y2="140" stroke="#3b82f6" stroke-width="3"/><circle cx="140" cy="30" r="18" fill="#1e293b" stroke="#3b82f6" stroke-width="3"/><text x="140" y="30">5</text><circle cx="70" cy="90" r="18" fill="#1e293b" stroke="#10b981" stroke-width="3"/><text x="70" y="90">1</text><circle cx="210" cy="90" r="18" fill="#1e293b" stroke="#ef4444" stroke-width="3"/><text x="210" y="90">4</text><circle cx="170" cy="140" r="18" fill="#1e293b" stroke="#ef4444" stroke-width="3"/><text x="170" y="140">3</text><circle cx="250" cy="140" r="18" fill="#1e293b" stroke="#10b981" stroke-width="3"/><text x="250" y="140">6</text></svg>`;

  const bstEx1Svg = `data:image/svg+xml;base64,${Buffer.from(rawSvg1).toString('base64')}`;
  const bstEx2Svg = `data:image/svg+xml;base64,${Buffer.from(rawSvg2).toString('base64')}`;

  await prisma.problem.update({
    where: { id: problem.id },
    data: {
      images: {
        example1: bstEx1Svg,
        example2: bstEx2Svg
      }
    }
  });

  console.log(`Successfully updated BST base64 diagrams for problem: ${problem.title} (${problem.id})`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
