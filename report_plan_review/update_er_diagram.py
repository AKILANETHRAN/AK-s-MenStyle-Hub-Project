"""Build editable, monochrome Chen ER diagrams from the live SQLite schema."""

from pathlib import Path
import sqlite3
from xml.etree import ElementTree as ET


PAGE_WIDTH, PAGE_HEIGHT = 1123, 794  # A4 landscape in diagrams.net.
PROJECT_ROOT = Path(__file__).resolve().parents[1]
DB_PATH = PROJECT_ROOT / 'stylehub/stylehub-backend/config/stylehub.sqlite'

# Five tables are placed around a pentagon so the ER view reads as a circular
# model instead of a left-to-right flow.
ENTITY_POSITIONS = [
    (501, 265),  # top
    (790, 365),  # upper right
    (680, 535),  # lower right
    (320, 535),  # lower left
    (210, 365),  # upper left
]
RELATION_POSITIONS = [
    (650, 315), (735, 490), (500, 625), (285, 490), (360, 315)
]
ATTRIBUTE_POSITIONS = [
    [(440, 120), (530, 120), (620, 120), (440, 175), (530, 175), (620, 175)],
    [(920, 285), (1010, 285), (920, 340), (1010, 340), (920, 395), (1010, 395)],
    [(820, 520), (910, 520), (820, 575), (910, 575), (820, 630), (910, 630)],
    [(120, 520), (210, 520), (120, 575), (210, 575), (120, 630), (210, 630)],
    [(10, 285), (100, 285), (10, 340), (100, 340), (10, 395), (100, 395)],
]

# Repeated entities keep each relationship page readable.
PAGES = [
    ('Core Shopping', ('users', 'products', 'cart', 'cart_items', 'wishlists'),
     ('OWNS', 'HAS', 'CONTAINS', 'OWNS'), ('1', 'N', '1', 'N', '1', 'N', '1', '1')),
    ('Wishlist and Social', ('wishlist_items', 'friendships', 'wishlist_shares',
                            'wishlist_share_items', 'wishlist_feedback'),
     ('LINKS', 'SENDS', 'CONTAINS', 'RECEIVES'), ('N', '1', '1', 'N', '1', 'N', '1', 'N')),
    ('Orders and Purchases', ('orders', 'order_items', 'purchases', 'purchase_items', 'notification_deliveries'),
     ('HAS', 'HAS', 'CONTAINS', 'DELIVERS'), ('1', 'N', '1', 'N', '1', 'N', '1', 'N')),
    ('Personalised Features', ('recently_accessed', 'outfit_recommendations', 'try_on_results',
                               'notifications', 'products'),
     ('REFERS', 'MAKES', 'CREATES', 'USES'), ('N', '1', '1', 'N', '1', 'N', 'N', '1')),
]

# Important identifiers and business attributes are selected in schema order
# after these priorities. Tables with fewer than eight fields show every field.
PREFERRED = {
    'users': ('id', 'username', 'full_name', 'email', 'role', 'phone', 'city', 'created_at'),
    'products': ('id', 'name', 'brand', 'category', 'color', 'price', 'stock', 'status'),
    'orders': ('id', 'order_number', 'user_id', 'status', 'subtotal', 'total_amount', 'delivery_address', 'created_at'),
    'order_items': ('id', 'order_id', 'product_id', 'product_name', 'quantity', 'unit_price', 'discount', 'final_price'),
    'purchases': ('id', 'user_id', 'purchase_type', 'total_amount', 'delivery_name', 'delivery_phone', 'delivery_address', 'created_at'),
    'notification_deliveries': ('id', 'purchase_id', 'user_id', 'channel', 'status', 'recipient', 'event_type', 'created_at'),
    'try_on_results': ('id', 'user_id', 'product_id', 'user_image_path', 'garment_image_path', 'generated_image_path', 'category', 'status'),
}


def fields_for(conn, table):
    rows = conn.execute(f'PRAGMA table_info("{table}")').fetchall()
    if not rows:
        raise ValueError(f'Missing SQLite table: {table}')
    columns = [row[1] for row in rows]
    selected = [field for field in PREFERRED.get(table, ()) if field in columns]
    selected.extend(field for field in columns if field not in selected)
    return selected[:8], {row[1] for row in rows if row[5]}


def add_vertex(root, ident, label, shape, x, y, width, height, *, size=11, bold=False):
    style = (f'{shape};whiteSpace=wrap;html=1;rounded=0;'
             'fillColor=#FFFFFF;strokeColor=#000000;fontColor=#000000;'
             'fontFamily=Times New Roman;align=center;verticalAlign=middle;'
             f'fontSize={size};fontStyle={1 if bold else 0};')
    cell = ET.SubElement(root, 'mxCell', {
        'id': ident, 'value': label, 'style': style, 'vertex': '1', 'parent': '1',
    })
    ET.SubElement(cell, 'mxGeometry', {
        'x': str(x), 'y': str(y), 'width': str(width), 'height': str(height),
        'as': 'geometry',
    })


def add_text(root, ident, label, x, y, width, height, size=11, bold=False):
    cell = ET.SubElement(root, 'mxCell', {
        'id': ident, 'value': label,
        'style': ('text;html=1;strokeColor=none;fillColor=none;'
                  'fontColor=#000000;fontFamily=Times New Roman;'
                  f'fontSize={size};fontStyle={1 if bold else 0};'
                  'align=center;verticalAlign=middle;'),
        'vertex': '1', 'parent': '1',
    })
    ET.SubElement(cell, 'mxGeometry', {
        'x': str(x), 'y': str(y), 'width': str(width), 'height': str(height),
        'as': 'geometry',
    })


def add_edge(root, ident, source, target, cardinality='', waypoints=()):
    cell = ET.SubElement(root, 'mxCell', {
        'id': ident, 'value': cardinality,
        'style': ('endArrow=none;startArrow=none;html=1;rounded=0;'
                  'strokeColor=#000000;fontColor=#000000;'
                  'fontFamily=Times New Roman;fontSize=11;'
                  'labelBackgroundColor=#FFFFFF;'),
        'edge': '1', 'parent': '1', 'source': source, 'target': target,
    })
    geometry = ET.SubElement(cell, 'mxGeometry', {'relative': '1', 'as': 'geometry'})
    if waypoints:
        points = ET.SubElement(geometry, 'Array', {'as': 'points'})
        for x, y in waypoints:
            ET.SubElement(points, 'mxPoint', {'x': str(x), 'y': str(y)})


def create_er_diagram(output_path):
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(f'file:{DB_PATH.as_posix()}?mode=ro', uri=True)
    mxfile = ET.Element('mxfile', {
        'host': 'app.diagrams.net', 'modified': '2026-10-06T00:00:00.000Z',
        'agent': 'StyleHub report', 'version': '24.7.17', 'type': 'device',
    })
    try:
        for page_index, (title, tables, relations, cardinalities) in enumerate(PAGES, 1):
            diagram = ET.SubElement(mxfile, 'diagram', {
                'id': f'chen-{page_index}', 'name': title,
            })
            model = ET.SubElement(diagram, 'mxGraphModel', {
                'dx': str(PAGE_WIDTH), 'dy': str(PAGE_HEIGHT), 'grid': '1',
                'gridSize': '10', 'guides': '1', 'tooltips': '1', 'connect': '1',
                'arrows': '1', 'fold': '1', 'page': '1', 'pageScale': '1',
                'pageWidth': str(PAGE_WIDTH), 'pageHeight': str(PAGE_HEIGHT),
                'background': '#FFFFFF', 'math': '0', 'shadow': '0',
            })
            root = ET.SubElement(model, 'root')
            ET.SubElement(root, 'mxCell', {'id': '0'})
            ET.SubElement(root, 'mxCell', {'id': '1', 'parent': '0'})
            add_text(root, 'title', f'STYLEHUB {title.upper()} ER DIAGRAM',
                     55, 18, 1013, 30, size=17, bold=True)
            add_text(root, 'legend',
                     'Rectangle = Entity    Diamond = Relationship    Oval = Attribute    Underlined = Primary Key',
                     100, 48, 923, 24, size=11)

            for col, table in enumerate(tables):
                entity_id = f'entity-{col}'
                entity_x, entity_y = ENTITY_POSITIONS[col]
                base_x = entity_x - 50
                add_vertex(root, entity_id, table, 'rectangle', entity_x, entity_y,
                           120, 54, size=8, bold=True)
                fields, primary_keys = fields_for(conn, table)
                for i, field in enumerate(fields[:6]):
                    x, y = ATTRIBUTE_POSITIONS[col][i]
                    label = f'<u>{field}</u>' if field in primary_keys else field
                    attr_id = f'attribute-{col}-{i}'
                    add_vertex(root, attr_id, label, 'ellipse', x, y, 80, 30,
                               size=8 if len(field) > 16 else 9)
                    add_edge(root, f'attribute-line-{col}-{i}',
                             entity_id, attr_id)

            for rel_index, label in enumerate(relations):
                ident = f'relationship-{rel_index}'
                x, y = RELATION_POSITIONS[rel_index]
                add_vertex(root, ident, label, 'rhombus', x, y, 80, 60,
                           size=8, bold=True)
                add_edge(root, f'relation-left-{rel_index}',
                         f'entity-{rel_index}', ident, cardinalities[rel_index * 2])
                add_edge(root, f'relation-right-{rel_index}',
                         ident, f'entity-{rel_index + 1}', cardinalities[rel_index * 2 + 1])

            add_text(root, 'page-note',
                     'Attributes are actual SQLite columns; up to eight are shown per entity. '
                     'Cardinality denotes the relationship at each entity.',
                     80, 727, 963, 34, size=10)
    finally:
        conn.close()
    ET.ElementTree(mxfile).write(output_path, encoding='utf-8', xml_declaration=True)
    return output_path


if __name__ == '__main__':
    print(create_er_diagram(PROJECT_ROOT / 'report/StyleHub_ER_Diagram.drawio'))
