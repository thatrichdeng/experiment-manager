const { createClient } = require("@supabase/supabase-js")

const supabase = createClient(
  "https://vnrbidtckiaxljjzmxul.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZucmJpZHRja2lheGxqanpteHVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0OTM2NzAsImV4cCI6MjA2OTA2OTY3MH0._WO1fuFuFUXvlL6Gsz14CsyxbJzqztdv435FAVslg6I",
)

async function checkSchema() {
  try {
    console.log("🔍 Checking current database schema...\n")

    // Check what tables exist
    const { data: tables, error } = await supabase
      .from("information_schema.tables")
      .select("table_name")
      .eq("table_schema", "public")

    if (error) {
      console.error("Error fetching tables:", error)
      return
    }

    console.log("📋 Existing tables:")
    tables.forEach((table) => {
      console.log(`  - ${table.table_name}`)
    })

    console.log("\n🔍 Checking for required tables...")

    const requiredTables = [
      "experiments",
      "tags",
      "experiment_tags",
      "protocols",
      "files",
      "results",
      "user_profiles",
      "experiment_shares",
    ]

    const existingTableNames = tables.map((t) => t.table_name)
    const missingTables = requiredTables.filter((table) => !existingTableNames.includes(table))

    if (missingTables.length > 0) {
      console.log("\n❌ Missing tables:")
      missingTables.forEach((table) => {
        console.log(`  - ${table}`)
      })
    } else {
      console.log("\n✅ All required tables exist!")
    }

    // Check auth.users table
    try {
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()
      console.log(`\n👥 Auth users count: ${authUsers?.users?.length || 0}`)
    } catch (e) {
      console.log("\n⚠️  Cannot access auth.users (this is normal for client-side)")
    }
  } catch (error) {
    console.error("Error checking schema:", error)
  }
}

checkSchema()
