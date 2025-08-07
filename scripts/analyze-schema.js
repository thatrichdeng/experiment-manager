// Fetch and analyze the schema verification results
async function analyzeSchema() {
  try {
    const response = await fetch(
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Supabase%20Snippet%20Schema%20Verification%20for%20Experiments%20Table-1qBBDyCWksQsXYoK7eviohNojuhkYH.csv",
    )
    const csvText = await response.text()

    console.log("Raw CSV content:")
    console.log(csvText)
    console.log("\n" + "=".repeat(50) + "\n")

    // Parse CSV manually (simple parsing for this case)
    const lines = csvText.trim().split("\n")
    const headers = lines[0].split(",").map((h) => h.replace(/"/g, ""))

    console.log("Headers:", headers)
    console.log("\nColumns in experiments table:")
    console.log("=".repeat(40))

    const columns = []
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.replace(/"/g, ""))
      const column = {
        table_name: values[0],
        column_name: values[1],
        data_type: values[2],
        is_nullable: values[3],
      }
      columns.push(column)

      console.log(`${column.column_name.padEnd(20)} | ${column.data_type.padEnd(25)} | Nullable: ${column.is_nullable}`)
    }

    console.log("\n" + "=".repeat(50))
    console.log("ANALYSIS:")
    console.log("=".repeat(50))

    // Check for required columns
    const requiredColumns = [
      "id",
      "user_id",
      "title",
      "description",
      "researcher_name",
      "status",
      "created_at",
      "updated_at",
    ]
    const existingColumns = columns.map((c) => c.column_name)

    console.log("\nRequired columns status:")
    requiredColumns.forEach((col) => {
      const exists = existingColumns.includes(col)
      const status = exists ? "✅ EXISTS" : "❌ MISSING"
      console.log(`${col.padEnd(20)} | ${status}`)
    })

    console.log("\nExtra columns (not in our required list):")
    existingColumns.forEach((col) => {
      if (!requiredColumns.includes(col)) {
        console.log(`${col.padEnd(20)} | ℹ️  EXTRA (from your original schema)`)
      }
    })

    // Check if user_id exists and is properly typed
    const userIdColumn = columns.find((c) => c.column_name === "user_id")
    if (userIdColumn) {
      console.log("\n✅ user_id column found!")
      console.log(`   Type: ${userIdColumn.data_type}`)
      console.log(`   Nullable: ${userIdColumn.is_nullable}`)

      if (userIdColumn.data_type === "uuid") {
        console.log("   ✅ Correct UUID type")
      } else {
        console.log("   ⚠️  Expected UUID type")
      }
    } else {
      console.log("\n❌ user_id column is missing - migration may have failed")
    }

    console.log("\n" + "=".repeat(50))
    console.log("NEXT STEPS:")
    console.log("=".repeat(50))

    if (userIdColumn) {
      console.log("✅ Migration appears successful!")
      console.log("📝 You can now:")
      console.log("   1. Test the authentication in the app")
      console.log("   2. Create a new experiment")
      console.log("   3. Check if RLS policies are working")
    } else {
      console.log("❌ Migration incomplete - user_id column missing")
      console.log("📝 You may need to:")
      console.log("   1. Run the migration script again")
      console.log("   2. Check for error messages")
      console.log("   3. Manually add the user_id column")
    }
  } catch (error) {
    console.error("Error analyzing schema:", error)
  }
}

// Run the analysis
analyzeSchema()
