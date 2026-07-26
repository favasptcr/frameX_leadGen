#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: "Build FrameX LeadFlow MVP - mobile-first PWA for FrameX LGS Houston Expo lead capture. Next.js + MongoDB + custom JWT auth (Supabase deferred per user instruction). Mock OCR, local storage for images, PWA + offline queue."

backend:
  - task: "Auth (login/me) with JWT"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js, /app/lib/auth.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "POST /api/auth/login returns token+user for demo admin/staff; GET /api/auth/me returns current user. scrypt password hashing, HS256 JWT with 7-day expiry."
      - working: true
        agent: "testing"
        comment: "✅ All auth endpoints working correctly. POST /api/auth/login with valid credentials (admin@framex.com/admin123 and staff@framex.com/staff123) returns token and user object with correct role. Invalid credentials return 401 with error message. GET /api/auth/me with Bearer token returns current user details. JWT authentication working as expected."

  - task: "Seed demo data on first request"
    implemented: true
    working: true
    file: "/app/lib/seed.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Seeds 2 users, 1 active event (Houston Expo), 5 demo leads on first API hit. Also creates MongoDB indexes."
      - working: true
        agent: "testing"
        comment: "✅ Seed data working correctly. On first API call, system seeds 2 users (admin and staff), 1 active event (Houston Expo), and 5 demo leads. All seed leads are created by the staff user. MongoDB indexes created successfully. Stats show total=5, today=5, hot=2, followUps=3."

  - task: "Leads CRUD with role-based access"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "GET /api/leads (search, filters, sort), POST /api/leads (validates at least one contact), GET/PUT /api/leads/:id (staff can only edit own), DELETE /api/leads/:id (admin archive)."
      - working: true
        agent: "testing"
        comment: "✅ All CRUD operations working correctly. GET /api/leads returns all leads with filters working (priority=Hot, status=Qualified, follow_up=yes, search=Martinez, sort=oldest). POST /api/leads validates correctly (empty body returns 400, valid data creates lead). GET /api/leads/:id retrieves lead by ID. PUT /api/leads/:id enforces role-based access (staff can only edit their own leads, returns 403 when trying to edit admin's lead). DELETE /api/leads/:id is admin-only (staff gets 403, admin successfully archives with archived_at timestamp)."

  - task: "Duplicate detection"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "GET /api/leads/duplicates?email=&phone= returns matching non-archived leads by exact email or digit-suffix phone match."
      - working: true
        agent: "testing"
        comment: "✅ Duplicate detection working correctly. GET /api/leads/duplicates?email=test1@example.com returns matching leads (returns empty array when lead is archived, which is correct behavior). Endpoint properly filters by email and phone parameters."

  - task: "Business card upload"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js, /app/lib/storage.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "POST /api/upload accepts multipart, saves to /public/uploads via local storage provider, returns {url, key, mimeType, size}."
      - working: true
        agent: "testing"
        comment: "✅ File upload working correctly. POST /api/upload accepts multipart form data with image field, saves to /public/uploads, and returns {url, key, mimeType, size, uploadedAt}. Tested with 1x1 PNG (70 bytes), file saved successfully with URL /uploads/[timestamp]-[uuid].png."

  - task: "Mock OCR endpoint"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js, /app/lib/ocr.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "POST /api/ocr returns one of three sample business-card extractions after ~800ms. Interface is fully replaceable via OCR_PROVIDER env + lib/ocr.js."
      - working: true
        agent: "testing"
        comment: "✅ Mock OCR working correctly. POST /api/ocr accepts multipart image and returns {ok: true, full_name, company, email, ...} with sample business card data. Response includes fields like full_name='Michael Rodriguez', company='Rodriguez Steel Framing LLC'. Simulated delay working as expected (~800ms)."

  - task: "Events (active event get/edit)"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "GET /api/events/active returns active event; PUT /api/events/active (admin only) updates name, venue, event_date, booth_number."
      - working: true
        agent: "testing"
        comment: "✅ Events endpoints working correctly. GET /api/events/active returns Houston Expo event. PUT /api/events/active with admin token successfully updates booth_number to 'A-123'. Staff user attempting PUT returns 403 'Admin only' error as expected. Role-based access control working correctly."

  - task: "Dashboard stats"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "GET /api/stats returns total, today, hot, followUps, recent[5]."
      - working: true
        agent: "testing"
        comment: "✅ Dashboard stats working correctly. GET /api/stats returns all required fields: total=5, today=5, hot=2, followUps=3, recent array with 5 lead objects. All counts accurate based on seed data."

  - task: "CSV export (admin only)"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "GET /api/leads/export?scope=all|event|hot|follow_up|filtered returns CSV with all fields. Admin-only."
      - working: true
        agent: "testing"
        comment: "✅ CSV export working correctly. Staff user gets 403 as expected. Admin user with scope=all returns CSV (2786 bytes) with proper header row (id,full_name,company,...). Admin user with scope=hot returns CSV (1267 bytes) with only Hot priority leads. Content-Type is text/csv. All export scopes working correctly."

frontend:
  - task: "Full lead-capture UI"
    implemented: true
    working: "NA"
    file: "/app/app/page.js, /app/app/layout.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Single-page client app with view routing (login/dashboard/new/scan/manual/list/detail/export/settings/sync). Mobile-first, industrial slate/amber design, sticky Scan New Lead CTA. IndexedDB offline queue with auto-sync on reconnect. PWA manifest + service worker registered."

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 2
  run_ui: false

test_plan:
  current_focus: []
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: "Initial FrameX LeadFlow MVP build complete. Please test all backend endpoints. Auth: use admin@framex.com/admin123 (admin) or staff@framex.com/staff123 (staff). Seed runs on first API call. All routes prefixed with /api. Focus areas: login flow, lead create with validation (>=1 of name/email/phone/company), staff-vs-admin lead edit permission, duplicate detection, CSV export admin-only, upload accepting multipart, mock OCR returning fields shape."
  - agent: "testing"
    message: "✅ ALL BACKEND TESTS PASSED (16/16). Comprehensive testing completed on all endpoints. All authentication, CRUD operations, role-based access control, validation, file upload, OCR, and CSV export functionality working correctly. No critical issues found. Backend is production-ready. Test results saved in /app/backend_test.py. All tasks marked as working=true and needs_retesting=false."
