/**
 * Supabase Edge Functions - Comprehensive Test Suite
 * 
 * This script tests all 23 Supabase Edge Functions to verify:
 * - Proper connectivity to Supabase
 * - Data flow and database queries
 * - External API integrations
 * - Authentication and authorization
 * - Error handling
 * 
 * Usage: deno run --allow-net --allow-env SUPABASE_FUNCTIONS_TEST.ts
 */

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") || "https://jlgwbbqydjeokypoenoc.supabase.co";
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY");

// Test configuration
interface TestResult {
  functionName: string;
  status: "pass" | "fail" | "warning";
  message: string;
  duration: number;
  details?: any;
}

const results: TestResult[] = [];

// Helper function to test a function
async function testFunction(
  functionName: string,
  payload: any,
  requiresAuth: boolean = false,
  authToken?: string
): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY || "",
    };
    
    if (requiresAuth && authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }
    
    const url = `${SUPABASE_URL}/functions/v1/${functionName}`;
    console.log(`\n🔍 Testing: ${functionName}`);
    console.log(`   URL: ${url}`);
    
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    
    const duration = Date.now() - startTime;
    const responseData = await response.json().catch(() => ({ error: "Invalid JSON response" }));
    
    if (response.ok) {
      console.log(`   ✅ PASS (${duration}ms)`);
      return {
        functionName,
        status: "pass",
        message: `Success: ${response.status}`,
        duration,
        details: responseData,
      };
    } else if (response.status === 401 || response.status === 403) {
      console.log(`   ⚠️  WARNING: Authentication required (${duration}ms)`);
      return {
        functionName,
        status: "warning",
        message: `Authentication required: ${response.status}`,
        duration,
        details: responseData,
      };
    } else {
      console.log(`   ❌ FAIL: ${response.status} (${duration}ms)`);
      return {
        functionName,
        status: "fail",
        message: `HTTP ${response.status}: ${responseData.error || "Unknown error"}`,
        duration,
        details: responseData,
      };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`   ❌ FAIL: ${error.message} (${duration}ms)`);
    return {
      functionName,
      status: "fail",
      message: `Error: ${error.message}`,
      duration,
    };
  }
}

// Test runner
async function runTests() {
  console.log("🚀 Starting Supabase Edge Functions Test Suite\n");
  console.log("=" .repeat(80));
  
  // 1. Authentication & Authorization Functions
  console.log("\n📋 CATEGORY 1: Authentication & Authorization");
  console.log("-" .repeat(80));
  
  results.push(await testFunction("demo-login", {}));
  results.push(await testFunction("accept-invite", { 
    token: "test-token" 
  }));
  results.push(await testFunction("invite-user", { 
    email: "test@example.com",
    role: "viewer",
    permissions: []
  }, true));
  results.push(await testFunction("resend-invite", { 
    invitationId: "test-id" 
  }, true));
  
  // 2. Payment & Subscription Functions
  console.log("\n📋 CATEGORY 2: Payment & Subscription");
  console.log("-" .repeat(80));
  
  results.push(await testFunction("check-subscription", {}, true));
  results.push(await testFunction("create-checkout-session", {
    tierId: "starter",
    isAnnual: false,
    fleetSize: 5
  }));
  results.push(await testFunction("create-payment-checkout", {
    booking_id: "test-booking",
    amount: 100,
    payment_type: "rental",
    customer_email: "test@example.com",
    customer_name: "Test Customer"
  }, true));
  results.push(await testFunction("customer-portal", {}, true));
  results.push(await testFunction("stripe-get-balance", {}, true));
  results.push(await testFunction("stripe-payment-history", {
    limit: 10
  }, true));
  results.push(await testFunction("export-payments", {
    format: "csv"
  }, true));
  
  // 3. AI/ML Functions
  console.log("\n📋 CATEGORY 3: AI/ML Functions");
  console.log("-" .repeat(80));
  
  results.push(await testFunction("ai-pricing", {
    vehicle: {
      id: "test-id",
      name: "Test Car",
      make: "Ferrari",
      model: "SF90",
      year: 2024,
      currentRate: 1000,
      utilization: 75,
      revenue: 50000
    }
  }));
  results.push(await testFunction("fleet-copilot-chat", {
    messages: [
      { role: "user", content: "How many vehicles do I have?" }
    ]
  }, true));
  results.push(await testFunction("generate-report", {
    reportType: "revenue",
    dateRange: { start: "2025-01-01", end: "2025-01-31" },
    format: "json"
  }));
  
  // 4. Voice/Text Processing Functions
  console.log("\n📋 CATEGORY 4: Voice/Text Processing");
  console.log("-" .repeat(80));
  
  results.push(await testFunction("text-to-speech", {
    text: "Hello, this is a test."
  }));
  results.push(await testFunction("voice-to-text", {
    audio: "base64-encoded-audio-data"
  }));
  results.push(await testFunction("elevenlabs-session", {
    userId: "test-user"
  }));
  results.push(await testFunction("elevenlabs-tools", {
    get_fleet_vehicles: "status:all"
  }));
  
  // 5. Notification Functions
  console.log("\n📋 CATEGORY 5: Notification Functions");
  console.log("-" .repeat(80));
  
  results.push(await testFunction("mention-notification", {
    mentionedUserIds: ["test-user-id"],
    senderId: "sender-id",
    senderName: "Test Sender",
    messageContent: "Test message",
    conversationId: "conv-id",
    messageId: "msg-id"
  }));
  results.push(await testFunction("role-change-notification", {
    userId: "test-user",
    oldRole: "viewer",
    newRole: "operator",
    oldPermissions: [],
    newPermissions: ["view_vehicles"],
    changedBy: "admin-id"
  }, true));
  results.push(await testFunction("slack-notify", {
    user_id: "test-user",
    message: "Test notification",
    test: true,
    webhookUrl: "https://hooks.slack.com/test"
  }));
  
  // 6. Data/External API Functions
  console.log("\n📋 CATEGORY 6: Data/External API Functions");
  console.log("-" .repeat(80));
  
  results.push(await testFunction("predicthq-events", {
    city: "miami",
    days: 14
  }));
  results.push(await testFunction("rari-mcp-server", {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2024-11-05" }
  }));
  
  // Print summary
  console.log("\n" + "=".repeat(80));
  console.log("📊 TEST SUMMARY");
  console.log("=".repeat(80));
  
  const passed = results.filter(r => r.status === "pass").length;
  const failed = results.filter(r => r.status === "fail").length;
  const warnings = results.filter(r => r.status === "warning").length;
  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
  
  console.log(`\nTotal Functions Tested: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⚠️  Warnings: ${warnings}`);
  console.log(`⏱️  Average Duration: ${avgDuration.toFixed(2)}ms\n`);
  
  // Detailed results
  console.log("📋 DETAILED RESULTS\n");
  
  results.forEach((result, index) => {
    const icon = result.status === "pass" ? "✅" : result.status === "warning" ? "⚠️" : "❌";
    console.log(`${index + 1}. ${icon} ${result.functionName}`);
    console.log(`   Status: ${result.status.toUpperCase()}`);
    console.log(`   Message: ${result.message}`);
    console.log(`   Duration: ${result.duration}ms`);
    if (result.details?.error) {
      console.log(`   Error: ${result.details.error}`);
    }
    console.log("");
  });
  
  // Export results to JSON
  const reportPath = "./supabase-functions-test-report.json";
  await Deno.writeTextFile(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      passed,
      failed,
      warnings,
      avgDuration: parseFloat(avgDuration.toFixed(2))
    },
    results
  }, null, 2));
  
  console.log(`📄 Full report saved to: ${reportPath}`);
  
  // Exit code
  if (failed > 0) {
    Deno.exit(1);
  }
}

// Run the tests
if (import.meta.main) {
  runTests();
}
