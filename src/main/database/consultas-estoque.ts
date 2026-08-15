/**
 * Consultas de estoque compartilhadas entre os handlers e os testes.
 *
 * Ficam aqui, sem importar `electron`, para que os testes rodem exatamente este
 * SQL sobre o sql.js. O filtro de arquivados vive neste arquivo: se ele fosse
 * copiado para o teste, a cobertura não protegeria a consulta real.
 *
 * Uma variação está inativa quando ela própria foi arquivada ou quando o
 * produto dela foi — ver a migração 2.
 */

export const SQL_VARIACOES_ESGOTADAS = `
  SELECT
    pv.id,
    p.name    AS productName,
    c.name    AS categoryName,
    pv.identifier,
    pv.stock_quantity  AS stockQuantity,
    pv.minimum_stock   AS minimumStock
  FROM product_variations pv
  JOIN products p ON p.id = pv.product_id
  JOIN categories c ON c.id = p.category_id
  WHERE pv.stock_quantity = 0
    AND pv.archived_at IS NULL
    AND p.archived_at IS NULL
  ORDER BY p.name, pv.identifier
`

export const SQL_VARIACOES_ABAIXO_DO_MINIMO = `
  SELECT
    pv.id,
    p.name    AS productName,
    c.name    AS categoryName,
    pv.identifier,
    pv.stock_quantity  AS stockQuantity,
    pv.minimum_stock   AS minimumStock
  FROM product_variations pv
  JOIN products p ON p.id = pv.product_id
  JOIN categories c ON c.id = p.category_id
  WHERE pv.stock_quantity > 0
    AND pv.stock_quantity < pv.minimum_stock
    AND pv.archived_at IS NULL
    AND p.archived_at IS NULL
  ORDER BY (pv.stock_quantity - pv.minimum_stock) ASC
`

export const SQL_INSUMOS_ESGOTADOS = `
  SELECT id, name, unit,
    stock_quantity AS stockQuantity,
    minimum_stock  AS minimumStock
  FROM insumos
  WHERE minimum_stock > 0
    AND stock_quantity = 0
    AND archived_at IS NULL
  ORDER BY name
`

export const SQL_INSUMOS_ABAIXO_DO_MINIMO = `
  SELECT id, name, unit,
    stock_quantity AS stockQuantity,
    minimum_stock  AS minimumStock
  FROM insumos
  WHERE minimum_stock > 0
    AND stock_quantity > 0
    AND stock_quantity < minimum_stock
    AND archived_at IS NULL
  ORDER BY (stock_quantity - minimum_stock) ASC
`

/**
 * Lista completa de insumos, arquivados inclusive — a tela precisa dos dois
 * grupos. `usadoPorVariacoesAtivas` alimenta o aviso antes de arquivar: um
 * insumo ainda em uso pode ser arquivado, mas ela merece saber disso antes.
 */
export const SQL_INSUMOS_COM_USO = `
  SELECT
    i.id,
    i.name,
    i.unit,
    i.cost_per_unit   AS costPerUnit,
    i.stock_quantity  AS stockQuantity,
    i.minimum_stock   AS minimumStock,
    i.created_at      AS createdAt,
    i.archived_at     AS archivedAt,
    (SELECT COUNT(*)
       FROM variation_insumos vi
       JOIN product_variations pv ON pv.id = vi.variation_id
       JOIN products p ON p.id = pv.product_id
      WHERE vi.insumo_id = i.id
        AND pv.archived_at IS NULL
        AND p.archived_at IS NULL) AS usadoPorVariacoesAtivas
  FROM insumos i
  ORDER BY i.name
`
