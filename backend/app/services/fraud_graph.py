"""
Additional Module 3 - Fraud Network.

Builds a graph from the identity_links table: nodes are devices, phone
numbers, and document numbers; an edge connects a device/phone/doc-number
to every verification that used it. One phone number showing up across
30 different document numbers becomes one hub node with 30 spokes - the
"exploding node" pattern the frontend visualizes.

This is a lightweight local heuristic over your own verification history,
not a connection to any real external fraud-consortium database.
"""
import networkx as nx

from .. import models


def build_graph(db, verification_id: str) -> dict:
    """Returns {"nodes": [...], "edges": [...], "flagged": bool, "linked_count": int}
    for the connected component containing `verification_id`, or an empty
    graph if that verification has no identity_links row yet."""
    anchor = db.query(models.IdentityLink).filter(
        models.IdentityLink.verification_id == verification_id
    ).first()
    if not anchor:
        return {"nodes": [], "edges": [], "flagged": False, "linked_count": 0}

    all_links = db.query(models.IdentityLink).all()

    g = nx.Graph()
    for link in all_links:
        v_node = f"verification:{link.verification_id}"
        g.add_node(v_node, kind="verification")
        for value, kind in (
            (link.device_id_hash, "device"),
            (link.phone_number, "phone"),
            (link.id_number, "document"),
        ):
            if not value:
                continue
            key_node = f"{kind}:{value}"
            g.add_node(key_node, kind=kind, label=value)
            g.add_edge(v_node, key_node)

    anchor_node = f"verification:{verification_id}"
    if anchor_node not in g:
        return {"nodes": [], "edges": [], "flagged": False, "linked_count": 0}

    component = nx.node_connected_component(g, anchor_node)
    sub = g.subgraph(component)

    verification_nodes = [n for n, d in sub.nodes(data=True) if d.get("kind") == "verification"]
    linked_count = len(verification_nodes) - 1  # exclude the anchor itself

    nodes = [
        {
            "id": n,
            "kind": d.get("kind"),
            "label": d.get("label", n.split(":", 1)[1][:8]),
            "degree": sub.degree(n),
            "is_anchor": n == anchor_node,
        }
        for n, d in sub.nodes(data=True)
    ]
    edges = [{"source": u, "target": v} for u, v in sub.edges()]

    return {
        "nodes": nodes,
        "edges": edges,
        "flagged": linked_count >= 3,  # 3+ other verifications sharing a device/phone/doc = worth a look
        "linked_count": linked_count,
    }
