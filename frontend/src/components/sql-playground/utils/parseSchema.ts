export interface ColumnInfo {
  name: string;
  type: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  references?: {
    table: string;
    column: string;
  };
}

export interface TableNodeData {
  id: string;
  name: string;
  columns: ColumnInfo[];
  categoryColor?: string;
}

export interface RelationshipEdge {
  id: string;
  source: string;
  target: string;
  sourceColumn: string;
  targetColumn: string;
  label?: string;
}

export interface SchemaGraph {
  nodes: TableNodeData[];
  edges: RelationshipEdge[];
}

const CATEGORY_COLORS = [
  'from-blue-500/20 to-indigo-500/5 text-blue-400 border-blue-500/30',
  'from-emerald-500/20 to-teal-500/5 text-emerald-400 border-emerald-500/30',
  'from-purple-500/20 to-pink-500/5 text-purple-400 border-purple-500/30',
  'from-amber-500/20 to-orange-500/5 text-amber-400 border-amber-500/30',
  'from-cyan-500/20 to-sky-500/5 text-cyan-400 border-cyan-500/30',
  'from-rose-500/20 to-red-500/5 text-rose-400 border-rose-500/30',
];

export function parseSchemaToGraph(rawTables: any[], problemDescription?: string): SchemaGraph {
  const nodesMap = new Map<string, TableNodeData>();
  const edges: RelationshipEdge[] = [];

  if (Array.isArray(rawTables) && rawTables.length > 0) {
    rawTables.forEach((t, idx) => {
      const tableName = t.name || t.id || `Table_${idx + 1}`;
      const columns: ColumnInfo[] = (t.columns || []).map((col: any) => {
        const colName = col.name || col;
        const colType = (col.type || 'VARCHAR').toUpperCase();
        const constraintsStr = String(col.constraints || '').toUpperCase();

        const isPrimaryKey = constraintsStr.includes('PRIMARY') || col.isPrimaryKey || false;
        let isForeignKey = constraintsStr.includes('FOREIGN') || col.isForeignKey || false;
        let references: { table: string; column: string } | undefined = undefined;

        // Check if explicit REFERENCES clause exists in constraints
        const refMatch = constraintsStr.match(/REFERENCES\s+`?(\w+)`?\s*\(`?(\w+)`?\)/i);
        if (refMatch) {
          isForeignKey = true;
          references = { table: refMatch[1], column: refMatch[2] };
        } else if (colName.toLowerCase().endsWith('id') && colName.toLowerCase() !== 'id') {
          // Infer FK based on naming convention e.g. departmentId -> Department.id, user_id -> Users.id, category_id -> Categories.id
          const possibleRefTable = colName.replace(/_?id$/i, '');
          isForeignKey = true;
          references = { table: possibleRefTable, column: 'id' };
        }

        return {
          name: colName,
          type: colType,
          isPrimaryKey,
          isForeignKey,
          references,
        };
      });

      nodesMap.set(tableName, {
        id: tableName,
        name: tableName,
        columns,
        categoryColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
      });
    });
  }

  // Parse markdown description for explicit FK statements e.g. "user_id is a foreign key referencing the id of the Users table"
  if (problemDescription && typeof problemDescription === 'string') {
    const descFKRegex = /`?(\w+)`?\s+is\s+(?:a\s+)?foreign\s+key\s+referencing\s+(?:the\s+)?`?(\w+)`?\s+of\s+(?:the\s+)?`?(\w+)`?/gi;
    let match;
    while ((match = descFKRegex.exec(problemDescription)) !== null) {
      const colName = match[1];
      const targetCol = match[2];
      const targetTable = match[3];

      nodesMap.forEach(node => {
        node.columns.forEach(col => {
          if (col.name.toLowerCase() === colName.toLowerCase()) {
            col.isForeignKey = true;
            col.references = { table: targetTable, column: targetCol };
          }
        });
      });
    }
  }

  // Helper for matching singular/plural table names e.g. "user" -> "Users", "category" -> "Categories"
  const findMatchingTable = (refTable: string): string | undefined => {
    const ref = refTable.toLowerCase().trim();
    return Array.from(nodesMap.keys()).find(t => {
      const tbl = t.toLowerCase().trim();
      if (tbl === ref) return true;
      if (tbl === ref + 's' || tbl === ref + 'es') return true;
      if (ref.endsWith('y') && tbl === ref.slice(0, -1) + 'ies') return true;
      if (tbl.endsWith('y') && ref === tbl.slice(0, -1) + 'ies') return true;
      if (tbl.replace(/s$/, '') === ref.replace(/s$/, '')) return true;
      return false;
    });
  };

  // Create relationship edges
  nodesMap.forEach(sourceNode => {
    sourceNode.columns.forEach(col => {
      if (col.isForeignKey && col.references) {
        const targetTableName = findMatchingTable(col.references.table);

        if (targetTableName && targetTableName !== sourceNode.id) {
          const edgeId = `edge_${sourceNode.id}_${col.name}_to_${targetTableName}_${col.references.column}`;
          // Avoid duplicate edges
          if (!edges.some(e => e.id === edgeId)) {
            edges.push({
              id: edgeId,
              source: sourceNode.id,
              target: targetTableName,
              sourceColumn: col.name,
              targetColumn: col.references.column,
              label: `${sourceNode.id}.${col.name} → ${targetTableName}.${col.references.column}`,
            });
          }
        }
      }
    });
  });

  return {
    nodes: Array.from(nodesMap.values()),
    edges,
  };
}
