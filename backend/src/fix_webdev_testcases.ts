import prisma from './lib/prisma';

async function main() {
  const problemId = '45e4e62c-f8c1-4090-b25f-66be8fc5f9da';
  const problem = await prisma.problem.findUnique({
    where: { id: problemId },
    include: { testCases: true }
  });

  if (!problem) {
    console.error('Problem not found');
    return;
  }

  console.log(`Fixing test cases for problem: ${problem.title}`);

  const fixes = [
    {
      id: '8b45bd66-b0fb-4d8f-9f3f-ae86eba68579',
      input: JSON.stringify({
        steps: [
          { action: 'type', selector: '#task-input', value: 'Write report' },
          { action: 'click', selector: '#add-btn' }
        ],
        assert: { selector: '#todo .count', property: 'textContent', expected: '1' }
      }),
      expectedOutput: '1'
    },
    {
      id: '0dbc2abb-0bc9-4ab7-8234-0b70983c1c19',
      input: JSON.stringify({
        steps: [
          { action: 'type', selector: '#task-input', value: 'Fix bug' },
          { action: 'press', selector: '#task-input', key: 'Enter' }
        ],
        assert: { selector: '#todo .count', property: 'textContent', expected: '1' }
      }),
      expectedOutput: '1'
    },
    {
      id: '759b1319-996d-4c3e-80ca-c66eef6e7980',
      input: JSON.stringify({
        steps: [
          { action: 'type', selector: '#task-input', value: 'Task 1' },
          { action: 'click', selector: '#add-btn' },
          { action: 'type', selector: '#task-input', value: 'Task 2' },
          { action: 'click', selector: '#add-btn' },
          { action: 'type', selector: '#task-input', value: 'Task 3' },
          { action: 'click', selector: '#add-btn' }
        ],
        assert: { selector: '#todo .count', property: 'textContent', expected: '3' }
      }),
      expectedOutput: '3'
    },
    {
      id: '95ca9975-bcb2-4222-bab2-c47de28616c4',
      input: JSON.stringify({
        steps: [
          { action: 'type', selector: '#task-input', value: 'Design mockup' },
          { action: 'click', selector: '#add-btn' },
          { action: 'drag', selector: '#todo .task-list .task-card', targetSelector: '#done .task-list' }
        ],
        assert: { selector: '#done .count', property: 'textContent', expected: '1' }
      }),
      expectedOutput: '1'
    },
    {
      id: 'a388fd06-8b0e-42f0-92d3-7b1e402fe0e5',
      input: JSON.stringify({
        steps: [
          { action: 'type', selector: '#task-input', value: '   ' },
          { action: 'click', selector: '#add-btn' }
        ],
        assert: { selector: '#todo .task-list .task-card', property: 'count', expected: '0' }
      }),
      expectedOutput: '0'
    },
    {
      id: 'e5f4fca1-4505-4696-b7bc-c9c821e29e96',
      input: JSON.stringify({
        steps: [
          { action: 'type', selector: '#task-input', value: 'Review PR' },
          { action: 'click', selector: '#add-btn' },
          { action: 'drag', selector: '#todo .task-list .task-card', targetSelector: '#in-progress .task-list' },
          { action: 'drag', selector: '#in-progress .task-list .task-card', targetSelector: '#done .task-list' }
        ],
        assert: { selector: '#done .count', property: 'textContent', expected: '1' }
      }),
      expectedOutput: '1'
    },
    {
      id: 'fa1618d7-245a-420a-868e-293f2ebd925a',
      input: JSON.stringify({
        steps: [
          { action: 'type', selector: '#task-input', value: 'Old task' },
          { action: 'click', selector: '#add-btn' },
          { action: 'click', selector: '#todo .task-list .task-card .remove-btn' }
        ],
        assert: { selector: '#todo .count', property: 'textContent', expected: '0' }
      }),
      expectedOutput: '0'
    }
  ];

  for (const fix of fixes) {
    await prisma.testCase.update({
      where: { id: fix.id },
      data: {
        input: fix.input,
        expectedOutput: fix.expectedOutput
      }
    });
    console.log(`✅ Updated testcase ${fix.id}`);
  }

  console.log('🎉 All test cases updated successfully!');
}

main().finally(() => prisma.$disconnect());
