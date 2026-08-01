const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const sqlProblems = [
  {
    title: 'Combine Two Tables',
    slug: 'combine-two-tables',
    difficulty: 'Easy',
    category: 'Database',
    problemType: 'sql',
    isPublic: true,
    description: 'Write a SQL query to report the first name, last name, city, and state of each person in the `Person` table. If the address of a `personId` is not present in the `Address` table, report `null` instead.\n\nReturn the result table in any order.',
    starterCode: {
      sql: '-- Write your SQL query below\nSELECT \n    p.firstName, \n    p.lastName, \n    a.city, \n    a.state\nFROM Person p\nLEFT JOIN Address a ON p.personId = a.personId;\n',
      schema: {
        tables: [
          {
            name: 'Person',
            columns: [
              { name: 'personId', type: 'INT', constraints: 'PRIMARY KEY' },
              { name: 'lastName', type: 'VARCHAR(50)' },
              { name: 'firstName', type: 'VARCHAR(50)' }
            ],
            sampleData: [
              { personId: 1, lastName: 'Wang', firstName: 'Allen' },
              { personId: 2, lastName: 'Alice', firstName: 'Bob' }
            ]
          },
          {
            name: 'Address',
            columns: [
              { name: 'addressId', type: 'INT', constraints: 'PRIMARY KEY' },
              { name: 'personId', type: 'INT' },
              { name: 'city', type: 'VARCHAR(50)' },
              { name: 'state', type: 'VARCHAR(50)' }
            ],
            sampleData: [
              { addressId: 1, personId: 2, city: 'New York City', state: 'New York' },
              { addressId: 2, personId: 3, city: 'Leetcode', state: 'California' }
            ]
          }
        ],
        setup: "CREATE TABLE Person (personId INT PRIMARY KEY, lastName VARCHAR(50), firstName VARCHAR(50)); INSERT INTO Person VALUES (1, 'Wang', 'Allen'), (2, 'Alice', 'Bob'); CREATE TABLE Address (addressId INT PRIMARY KEY, personId INT, city VARCHAR(50), state VARCHAR(50)); INSERT INTO Address VALUES (1, 2, 'New York City', 'New York'), (2, 3, 'Leetcode', 'California');"
      }
    },
    testCases: [
      {
        input: '',
        expectedOutput: 'firstName\tlastName\tcity\tstate\nAllen\tWang\tNULL\tNULL\nBob\tAlice\tNew York City\tNew York',
        isHidden: false,
        order: 1
      }
    ]
  },
  {
    title: 'Employees Earning More Than Their Managers',
    slug: 'employees-earning-more-than-their-managers',
    difficulty: 'Easy',
    category: 'Database',
    problemType: 'sql',
    isPublic: true,
    description: 'Write a SQL query to find the employees who earn more than their managers.\n\nReturn the result table as an `Employee` column.',
    starterCode: {
      sql: '-- Write your SQL query below\nSELECT e1.name AS Employee\nFROM Employee e1\nJOIN Employee e2 ON e1.managerId = e2.id\nWHERE e1.salary > e2.salary;\n',
      schema: {
        tables: [
          {
            name: 'Employee',
            columns: [
              { name: 'id', type: 'INT', constraints: 'PRIMARY KEY' },
              { name: 'name', type: 'VARCHAR(50)' },
              { name: 'salary', type: 'INT' },
              { name: 'managerId', type: 'INT' }
            ],
            sampleData: [
              { id: 1, name: 'Joe', salary: 70000, managerId: 3 },
              { id: 2, name: 'Henry', salary: 80000, managerId: 4 },
              { id: 3, name: 'Sam', salary: 60000, managerId: null },
              { id: 4, name: 'Max', salary: 90000, managerId: null }
            ]
          }
        ],
        setup: "CREATE TABLE Employee (id INT PRIMARY KEY, name VARCHAR(50), salary INT, managerId INT); INSERT INTO Employee VALUES (1, 'Joe', 70000, 3), (2, 'Henry', 80000, 4), (3, 'Sam', 60000, NULL), (4, 'Max', 90000, NULL);"
      }
    },
    testCases: [
      {
        input: '',
        expectedOutput: 'Employee\nJoe',
        isHidden: false,
        order: 1
      }
    ]
  },
  {
    title: 'Duplicate Emails',
    slug: 'duplicate-emails',
    difficulty: 'Easy',
    category: 'Database',
    problemType: 'sql',
    isPublic: true,
    description: 'Write a SQL query to report all the duplicate emails. Return the result table as `Email` column.',
    starterCode: {
      sql: '-- Write your SQL query below\nSELECT email AS Email\nFROM Person\nGROUP BY email\nHAVING COUNT(email) > 1;\n',
      schema: {
        tables: [
          {
            name: 'Person',
            columns: [
              { name: 'id', type: 'INT', constraints: 'PRIMARY KEY' },
              { name: 'email', type: 'VARCHAR(100)' }
            ],
            sampleData: [
              { id: 1, email: 'a@b.com' },
              { id: 2, email: 'c@d.com' },
              { id: 3, email: 'a@b.com' }
            ]
          }
        ],
        setup: "CREATE TABLE Person (id INT PRIMARY KEY, email VARCHAR(100)); INSERT INTO Person VALUES (1, 'a@b.com'), (2, 'c@d.com'), (3, 'a@b.com');"
      }
    },
    testCases: [
      {
        input: '',
        expectedOutput: 'Email\na@b.com',
        isHidden: false,
        order: 1
      }
    ]
  },
  {
    title: 'Customers Who Never Order',
    slug: 'customers-who-never-order',
    difficulty: 'Easy',
    category: 'Database',
    problemType: 'sql',
    isPublic: true,
    description: 'Write a SQL query to report all customers who never order anything. Return the result table as `Customers` column.',
    starterCode: {
      sql: '-- Write your SQL query below\nSELECT name AS Customers\nFROM Customers\nWHERE id NOT IN (SELECT customerId FROM Orders WHERE customerId IS NOT NULL);\n',
      schema: {
        tables: [
          {
            name: 'Customers',
            columns: [
              { name: 'id', type: 'INT', constraints: 'PRIMARY KEY' },
              { name: 'name', type: 'VARCHAR(50)' }
            ],
            sampleData: [
              { id: 1, name: 'Joe' },
              { id: 2, name: 'Henry' },
              { id: 3, name: 'Sam' },
              { id: 4, name: 'Max' }
            ]
          },
          {
            name: 'Orders',
            columns: [
              { name: 'id', type: 'INT', constraints: 'PRIMARY KEY' },
              { name: 'customerId', type: 'INT' }
            ],
            sampleData: [
              { id: 1, customerId: 3 },
              { id: 2, customerId: 1 }
            ]
          }
        ],
        setup: "CREATE TABLE Customers (id INT PRIMARY KEY, name VARCHAR(50)); INSERT INTO Customers VALUES (1, 'Joe'), (2, 'Henry'), (3, 'Sam'), (4, 'Max'); CREATE TABLE Orders (id INT PRIMARY KEY, customerId INT); INSERT INTO Orders VALUES (1, 3), (2, 1);"
      }
    },
    testCases: [
      {
        input: '',
        expectedOutput: 'Customers\nHenry\nMax',
        isHidden: false,
        order: 1
      }
    ]
  },
  {
    title: 'Second Highest Salary',
    slug: 'second-highest-salary',
    difficulty: 'Medium',
    category: 'Database',
    problemType: 'sql',
    isPublic: true,
    description: 'Write a SQL query to report the second highest salary from the `Employee` table. If there is no second highest salary, return `null` as `SecondHighestSalary`.',
    starterCode: {
      sql: '-- Write your SQL query below\nSELECT (\n    SELECT DISTINCT salary \n    FROM Employee \n    ORDER BY salary DESC \n    LIMIT 1 OFFSET 1\n) AS SecondHighestSalary;\n',
      schema: {
        tables: [
          {
            name: 'Employee',
            columns: [
              { name: 'id', type: 'INT', constraints: 'PRIMARY KEY' },
              { name: 'salary', type: 'INT' }
            ],
            sampleData: [
              { id: 1, salary: 100 },
              { id: 2, salary: 200 },
              { id: 3, salary: 300 }
            ]
          }
        ],
        setup: "CREATE TABLE Employee (id INT PRIMARY KEY, salary INT); INSERT INTO Employee VALUES (1, 100), (2, 200), (3, 300);"
      }
    },
    testCases: [
      {
        input: '',
        expectedOutput: 'SecondHighestSalary\n200',
        isHidden: false,
        order: 1
      }
    ]
  }
];

async function main() {
  console.log('Seeding SQL problems into database...');
  for (const p of sqlProblems) {
    const { testCases, ...probData } = p;
    const existing = await prisma.problem.findUnique({ where: { slug: probData.slug } });
    let probId;
    if (existing) {
      const updated = await prisma.problem.update({
        where: { slug: probData.slug },
        data: probData
      });
      probId = updated.id;
      console.log('✓ Updated SQL problem:', updated.title);
    } else {
      const created = await prisma.problem.create({ data: probData });
      probId = created.id;
      console.log('✓ Created SQL problem:', created.title);
    }

    await prisma.testCase.deleteMany({ where: { problemId: probId } });
    for (const tc of testCases) {
      await prisma.testCase.create({
        data: {
          ...tc,
          problemId: probId
        }
      });
    }
  }
  console.log('🎉 Seeding complete! All 5 SQL problems are public and active in database.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
