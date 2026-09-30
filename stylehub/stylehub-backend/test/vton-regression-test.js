async function testVton() {
  const ids = [1, 10, 21, 27];
  console.log("=== RUNNING VTON ASSET REGRESSION TEST ===");
  for (const id of ids) {
    const res = await fetch(`http://localhost:5000/api/products/${id}`);
    if (!res.ok) {
      console.error(`Failed to fetch product ${id}: ${res.status}`);
      process.exit(1);
    }
    const data = await res.json();
    console.log(`Product #${id}:`);
    console.log(`  Name: ${data.name}`);
    console.log(`  Category: ${data.category}`);
    console.log(`  Color: ${data.color}`);
    console.log(`  VTON Supported: ${data.vton_supported}`);
    console.log(`  Garment Image: ${data.garment_image}`);

    // Verify backend serving
    const backendImgRes = await fetch(`http://localhost:5000${data.garment_image}`);
    console.log(`  Backend Asset HTTP: ${backendImgRes.status} (${backendImgRes.headers.get("content-type")})`);
    if (!backendImgRes.ok) {
      console.error(`Backend failed to serve garment image for product ${id}`);
      process.exit(1);
    }

    // Verify frontend serving
    const frontendImgRes = await fetch(`http://localhost:5173${data.garment_image}`);
    console.log(`  Frontend Asset HTTP: ${frontendImgRes.status} (${frontendImgRes.headers.get("content-type")})`);
    if (!frontendImgRes.ok) {
      console.error(`Frontend failed to serve garment image for product ${id}`);
      process.exit(1);
    }
    console.log(`  ✓ Product ${id} VTON verification PASSED\n`);
  }
  console.log("==================================================");
  console.log("=== ALL VTON REGRESSION TESTS PASSED (1, 10, 21, 27) ===");
  console.log("==================================================");
}

testVton().catch(err => {
  console.error("VTON test error:", err);
  process.exit(1);
});
