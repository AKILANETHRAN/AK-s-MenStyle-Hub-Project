"""Build the editable, A4 portrait StyleHub conceptual UML class diagram."""

from pathlib import Path
from xml.etree import ElementTree as ET


PAGE_W, PAGE_H = 794, 1123  # A4 portrait in diagrams.net page units.
BOX_W, BOX_H = 300, 145
LEFT_X, RIGHT_X = 70, 424
ROW_Y = [90, 259, 428, 597, 766, 935]

CLASSES = [
    ('User', 0, 0, ['+id: Integer', '+username: Text', '+email: Text', '+role: Text'], ['+register()', '+login()', '+updateProfile()']),
    ('Product', 1, 0, ['+id: Integer', '+name: Text', '+category: Text', '+price: Real', '+stock: Integer'], ['+getAllProducts()', '+getProductById()']),
    ('Cart', 0, 1, ['+id: Integer', '+userId: Integer'], ['+getCart()', '+addToCart()', '+clearCart()']),
    ('CartItem', 1, 1, ['+id: Integer', '+productId: Integer', '+size: Text', '+quantity: Integer'], ['+updateCartItemQuantity()', '+removeCartItem()']),
    ('Wishlist', 0, 2, ['+id: Integer', '+userId: Integer'], ['+getWishlist()', '+addToWishlist()', '+clearWishlist()']),
    ('WishlistItem', 1, 2, ['+id: Integer', '+productId: Integer'], ['+removeWishlistItem()']),
    ('Purchase', 0, 3, ['+id: Integer', '+userId: Integer', '+purchaseType: Text', '+totalAmount: Real'], ['+purchaseProduct()', '+purchaseCombo()', '+purchaseCart()']),
    ('PurchaseItem', 1, 3, ['+id: Integer', '+productId: Integer', '+size: Text', '+quantity: Integer'], ['+recordItem()', '+validateQuantity()']),
    ('Friendship', 0, 4, ['+requesterId: Integer', '+receiverId: Integer', '+status: Text'], ['+sendFriendRequest()', '+acceptFriendRequest()', '+rejectFriendRequest()']),
    ('WishlistShare', 1, 4, ['+id: Integer', '+senderId: Integer', '+receiverId: Integer'], ['+createWishlistShare()', '+getWishlistShareById()', '+addShareFeedback()']),
    ('TryOnResult', 0, 5, ['+id: Integer', '+userId: Integer', '+productId: Integer', '+status: Text'], ['+generateTryOn()', '+getHistory()', '+getResult()']),
    ('RecommendationEngine', 1, 5, ['-rules: MatchingRules'], ['+isEligibleForRecommendation()', '+getRecommendationsForProduct()']),
]

# The outer-margin lanes keep nonadjacent associations away from class text.
EDGES = [
    ('User', 'Cart', '1 : 1', None),
    ('Product', 'CartItem', '1 : many', None),
    ('Cart', 'CartItem', '1 : many', None),
    ('Wishlist', 'WishlistItem', '1 : many', None),
    ('Purchase', 'PurchaseItem', '1 : many', None),
    ('Friendship', 'WishlistShare', 'permits sharing', None),
    ('User', 'Wishlist', '', 52),
    ('User', 'Purchase', '', 42),
    ('User', 'Friendship', '', 32),
    ('User', 'TryOnResult', '', 22),
    ('Product', 'WishlistItem', '', 742),
    ('Product', 'PurchaseItem', '', 752),
    ('Product', 'RecommendationEngine', '', 762),
]


def vertex(parent, key, value, style, x, y, w, h):
    cell = ET.SubElement(parent, 'mxCell', {
        'id': key, 'value': value, 'style': style,
        'vertex': '1', 'parent': '1' if key.startswith('page-') else key.split('-')[0],
    })
    ET.SubElement(cell, 'mxGeometry', {
        'x': str(x), 'y': str(y), 'width': str(w), 'height': str(h), 'as': 'geometry',
    })
    return cell


def create_class_diagram(output_path):
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    mxfile = ET.Element('mxfile', {
        'host': 'app.diagrams.net', 'modified': '2026-10-06T00:00:00.000Z',
        'agent': 'StyleHub report', 'version': '24.7.17', 'type': 'device',
    })
    page = ET.SubElement(mxfile, 'diagram', {'id': 'class-a4', 'name': 'Class Diagram A4'})
    model = ET.SubElement(page, 'mxGraphModel', {
        'dx': '794', 'dy': '1123', 'grid': '1', 'gridSize': '10', 'guides': '1',
        'tooltips': '1', 'connect': '1', 'arrows': '1', 'fold': '1', 'page': '1',
        'pageScale': '1', 'pageWidth': str(PAGE_W), 'pageHeight': str(PAGE_H),
        'background': '#FFFFFF', 'math': '0', 'shadow': '0',
    })
    root = ET.SubElement(model, 'root')
    ET.SubElement(root, 'mxCell', {'id': '0'})
    ET.SubElement(root, 'mxCell', {'id': '1', 'parent': '0'})

    vertex(root, 'page-title', 'STYLEHUB CONCEPTUAL CLASS DIAGRAM',
           'text;html=1;strokeColor=none;fillColor=none;fontColor=#000000;fontFamily=Times New Roman;fontSize=17;fontStyle=1;align=center;verticalAlign=middle;',
           70, 20, 654, 28)
    vertex(root, 'page-note', 'Operations represent implemented controller and service actions.',
           'text;html=1;strokeColor=none;fillColor=none;fontColor=#000000;fontFamily=Times New Roman;fontSize=10;align=center;verticalAlign=middle;',
           70, 52, 654, 20)

    for name, col, row, attrs, methods in CLASSES:
        x, y = (LEFT_X if col == 0 else RIGHT_X), ROW_Y[row]
        group = ET.SubElement(root, 'mxCell', {
            'id': name, 'value': '', 'style': 'group;container=1;collapsible=0;',
            'vertex': '1', 'parent': '1',
        })
        ET.SubElement(group, 'mxGeometry', {
            'x': str(x), 'y': str(y), 'width': str(BOX_W), 'height': str(BOX_H), 'as': 'geometry',
        })
        vertex(root, f'{name}-header', name,
               'rounded=0;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#000000;fontColor=#000000;fontFamily=Times New Roman;fontSize=13;fontStyle=1;align=center;verticalAlign=middle;',
               0, 0, BOX_W, 27)
        vertex(root, f'{name}-attributes', '<br>'.join(attrs),
               'rounded=0;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#000000;fontColor=#000000;fontFamily=Times New Roman;fontSize=11;align=left;verticalAlign=middle;spacingLeft=8;',
               0, 27, BOX_W, 68)
        vertex(root, f'{name}-methods', '<br>'.join(methods),
               'rounded=0;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#000000;fontColor=#000000;fontFamily=Times New Roman;fontSize=11;align=left;verticalAlign=middle;spacingLeft=8;',
               0, 95, BOX_W, 50)

    centers = {name: ((LEFT_X if col == 0 else RIGHT_X) + BOX_W / 2,
                      ROW_Y[row] + BOX_H / 2)
               for name, col, row, _, _ in CLASSES}
    for index, (source, target, label, lane) in enumerate(EDGES, 1):
        edge = ET.SubElement(root, 'mxCell', {
            'id': f'edge-{index}', 'value': label,
            'style': 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;endArrow=none;startArrow=none;strokeColor=#000000;fontColor=#000000;fontFamily=Times New Roman;fontSize=10;labelBackgroundColor=#FFFFFF;',
            'edge': '1', 'parent': '1', 'source': source, 'target': target,
        })
        geom = ET.SubElement(edge, 'mxGeometry', {'relative': '1', 'as': 'geometry'})
        if lane is not None:
            points = ET.SubElement(geom, 'Array', {'as': 'points'})
            ET.SubElement(points, 'mxPoint', {'x': str(lane), 'y': str(int(centers[source][1]))})
            ET.SubElement(points, 'mxPoint', {'x': str(lane), 'y': str(int(centers[target][1]))})

    ET.ElementTree(mxfile).write(output_path, encoding='utf-8', xml_declaration=True)
    return output_path


if __name__ == '__main__':
    root_dir = Path(__file__).resolve().parents[1]
    result = create_class_diagram(root_dir / 'report/StyleHub_Class_Diagram.drawio')
    print(result)
