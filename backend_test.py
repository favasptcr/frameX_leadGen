#!/usr/bin/env python3
"""
FrameX LeadFlow Backend API Test Suite
Tests all backend endpoints with success and failure cases
"""

import requests
import json
import base64
import io
from datetime import datetime

# Base URL from .env
BASE_URL = "https://framex-houston.preview.emergentagent.com/api"

# Test credentials
ADMIN_EMAIL = "admin@framex.com"
ADMIN_PASSWORD = "admin123"
STAFF_EMAIL = "staff@framex.com"
STAFF_PASSWORD = "staff123"

# Global tokens
admin_token = None
staff_token = None
created_lead_id = None

def print_test(name, passed, details=""):
    """Print test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {name}")
    if details:
        print(f"   Details: {details}")

def test_root():
    """Test GET /api/root"""
    print("\n=== Testing Root Endpoint ===")
    try:
        resp = requests.get(f"{BASE_URL}/root", timeout=10)
        data = resp.json()
        passed = resp.status_code == 200 and data.get("ok") == True and data.get("app") == "FrameX LeadFlow"
        print_test("GET /api/root", passed, f"Response: {data}")
        return passed
    except Exception as e:
        print_test("GET /api/root", False, f"Error: {str(e)}")
        return False

def test_login_valid():
    """Test POST /api/auth/login with valid credentials"""
    print("\n=== Testing Login - Valid Credentials ===")
    global admin_token, staff_token
    
    # Test admin login
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", 
                           json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                           timeout=10)
        data = resp.json()
        admin_passed = resp.status_code == 200 and "token" in data and "user" in data
        if admin_passed:
            admin_token = data["token"]
            print_test("POST /api/auth/login (admin)", True, f"Token received, user role: {data['user'].get('role')}")
        else:
            print_test("POST /api/auth/login (admin)", False, f"Response: {data}")
    except Exception as e:
        print_test("POST /api/auth/login (admin)", False, f"Error: {str(e)}")
        admin_passed = False
    
    # Test staff login
    try:
        resp = requests.post(f"{BASE_URL}/auth/login",
                           json={"email": STAFF_EMAIL, "password": STAFF_PASSWORD},
                           timeout=10)
        data = resp.json()
        staff_passed = resp.status_code == 200 and "token" in data and "user" in data
        if staff_passed:
            staff_token = data["token"]
            print_test("POST /api/auth/login (staff)", True, f"Token received, user role: {data['user'].get('role')}")
        else:
            print_test("POST /api/auth/login (staff)", False, f"Response: {data}")
    except Exception as e:
        print_test("POST /api/auth/login (staff)", False, f"Error: {str(e)}")
        staff_passed = False
    
    return admin_passed and staff_passed

def test_login_invalid():
    """Test POST /api/auth/login with invalid credentials"""
    print("\n=== Testing Login - Invalid Credentials ===")
    try:
        resp = requests.post(f"{BASE_URL}/auth/login",
                           json={"email": ADMIN_EMAIL, "password": "wrongpassword"},
                           timeout=10)
        data = resp.json()
        passed = resp.status_code == 401 and "error" in data
        print_test("POST /api/auth/login (invalid password)", passed, f"Status: {resp.status_code}, Response: {data}")
        return passed
    except Exception as e:
        print_test("POST /api/auth/login (invalid password)", False, f"Error: {str(e)}")
        return False

def test_auth_me():
    """Test GET /api/auth/me"""
    print("\n=== Testing Auth Me ===")
    if not admin_token:
        print_test("GET /api/auth/me", False, "No admin token available")
        return False
    
    try:
        resp = requests.get(f"{BASE_URL}/auth/me",
                          headers={"Authorization": f"Bearer {admin_token}"},
                          timeout=10)
        data = resp.json()
        passed = resp.status_code == 200 and "user" in data and data["user"].get("email") == ADMIN_EMAIL
        print_test("GET /api/auth/me", passed, f"User: {data.get('user', {}).get('email')}")
        return passed
    except Exception as e:
        print_test("GET /api/auth/me", False, f"Error: {str(e)}")
        return False

def test_events_active_get():
    """Test GET /api/events/active"""
    print("\n=== Testing Get Active Event ===")
    if not admin_token:
        print_test("GET /api/events/active", False, "No admin token available")
        return False
    
    try:
        resp = requests.get(f"{BASE_URL}/events/active",
                          headers={"Authorization": f"Bearer {admin_token}"},
                          timeout=10)
        data = resp.json()
        passed = resp.status_code == 200 and "event" in data
        event_name = data.get("event", {}).get("name", "")
        print_test("GET /api/events/active", passed, f"Event: {event_name}")
        return passed
    except Exception as e:
        print_test("GET /api/events/active", False, f"Error: {str(e)}")
        return False

def test_events_active_put():
    """Test PUT /api/events/active (admin vs staff)"""
    print("\n=== Testing Update Active Event ===")
    
    # Test as admin (should succeed)
    if not admin_token:
        print_test("PUT /api/events/active (admin)", False, "No admin token available")
        admin_passed = False
    else:
        try:
            resp = requests.put(f"{BASE_URL}/events/active",
                              headers={"Authorization": f"Bearer {admin_token}"},
                              json={"booth_number": "A-123"},
                              timeout=10)
            data = resp.json()
            admin_passed = resp.status_code == 200 and data.get("event", {}).get("booth_number") == "A-123"
            print_test("PUT /api/events/active (admin)", admin_passed, f"Booth number updated: {data.get('event', {}).get('booth_number')}")
        except Exception as e:
            print_test("PUT /api/events/active (admin)", False, f"Error: {str(e)}")
            admin_passed = False
    
    # Test as staff (should fail with 403)
    if not staff_token:
        print_test("PUT /api/events/active (staff)", False, "No staff token available")
        staff_passed = False
    else:
        try:
            resp = requests.put(f"{BASE_URL}/events/active",
                              headers={"Authorization": f"Bearer {staff_token}"},
                              json={"booth_number": "B-456"},
                              timeout=10)
            data = resp.json()
            staff_passed = resp.status_code == 403 and "error" in data
            print_test("PUT /api/events/active (staff → 403)", staff_passed, f"Status: {resp.status_code}, Response: {data}")
        except Exception as e:
            print_test("PUT /api/events/active (staff → 403)", False, f"Error: {str(e)}")
            staff_passed = False
    
    return admin_passed and staff_passed

def test_stats():
    """Test GET /api/stats"""
    print("\n=== Testing Dashboard Stats ===")
    if not admin_token:
        print_test("GET /api/stats", False, "No admin token available")
        return False
    
    try:
        resp = requests.get(f"{BASE_URL}/stats",
                          headers={"Authorization": f"Bearer {admin_token}"},
                          timeout=10)
        data = resp.json()
        required_fields = ["total", "today", "hot", "followUps", "recent"]
        passed = resp.status_code == 200 and all(field in data for field in required_fields)
        print_test("GET /api/stats", passed, f"Stats: total={data.get('total')}, today={data.get('today')}, hot={data.get('hot')}, followUps={data.get('followUps')}, recent count={len(data.get('recent', []))}")
        return passed
    except Exception as e:
        print_test("GET /api/stats", False, f"Error: {str(e)}")
        return False

def test_leads_get():
    """Test GET /api/leads with filters"""
    print("\n=== Testing Get Leads ===")
    if not admin_token:
        print_test("GET /api/leads", False, "No admin token available")
        return False
    
    all_passed = True
    
    # Test basic get
    try:
        resp = requests.get(f"{BASE_URL}/leads",
                          headers={"Authorization": f"Bearer {admin_token}"},
                          timeout=10)
        data = resp.json()
        passed = resp.status_code == 200 and "leads" in data and len(data["leads"]) >= 5
        print_test("GET /api/leads (all)", passed, f"Found {len(data.get('leads', []))} leads")
        all_passed = all_passed and passed
    except Exception as e:
        print_test("GET /api/leads (all)", False, f"Error: {str(e)}")
        all_passed = False
    
    # Test filter by priority=Hot
    try:
        resp = requests.get(f"{BASE_URL}/leads?priority=Hot",
                          headers={"Authorization": f"Bearer {admin_token}"},
                          timeout=10)
        data = resp.json()
        leads = data.get("leads", [])
        passed = resp.status_code == 200 and all(lead.get("priority") == "Hot" for lead in leads)
        print_test("GET /api/leads?priority=Hot", passed, f"Found {len(leads)} hot leads")
        all_passed = all_passed and passed
    except Exception as e:
        print_test("GET /api/leads?priority=Hot", False, f"Error: {str(e)}")
        all_passed = False
    
    # Test filter by status=Qualified
    try:
        resp = requests.get(f"{BASE_URL}/leads?status=Qualified",
                          headers={"Authorization": f"Bearer {admin_token}"},
                          timeout=10)
        data = resp.json()
        leads = data.get("leads", [])
        passed = resp.status_code == 200 and all(lead.get("status") == "Qualified" for lead in leads)
        print_test("GET /api/leads?status=Qualified", passed, f"Found {len(leads)} qualified leads")
        all_passed = all_passed and passed
    except Exception as e:
        print_test("GET /api/leads?status=Qualified", False, f"Error: {str(e)}")
        all_passed = False
    
    # Test filter by follow_up=yes
    try:
        resp = requests.get(f"{BASE_URL}/leads?follow_up=yes",
                          headers={"Authorization": f"Bearer {admin_token}"},
                          timeout=10)
        data = resp.json()
        leads = data.get("leads", [])
        passed = resp.status_code == 200 and all(lead.get("follow_up_required") == True for lead in leads)
        print_test("GET /api/leads?follow_up=yes", passed, f"Found {len(leads)} leads requiring follow-up")
        all_passed = all_passed and passed
    except Exception as e:
        print_test("GET /api/leads?follow_up=yes", False, f"Error: {str(e)}")
        all_passed = False
    
    # Test search by name
    try:
        resp = requests.get(f"{BASE_URL}/leads?search=Martinez",
                          headers={"Authorization": f"Bearer {admin_token}"},
                          timeout=10)
        data = resp.json()
        leads = data.get("leads", [])
        passed = resp.status_code == 200 and len(leads) > 0
        print_test("GET /api/leads?search=Martinez", passed, f"Found {len(leads)} leads matching 'Martinez'")
        all_passed = all_passed and passed
    except Exception as e:
        print_test("GET /api/leads?search=Martinez", False, f"Error: {str(e)}")
        all_passed = False
    
    # Test sort=oldest
    try:
        resp = requests.get(f"{BASE_URL}/leads?sort=oldest",
                          headers={"Authorization": f"Bearer {admin_token}"},
                          timeout=10)
        data = resp.json()
        leads = data.get("leads", [])
        passed = resp.status_code == 200 and len(leads) > 0
        print_test("GET /api/leads?sort=oldest", passed, f"Found {len(leads)} leads sorted by oldest")
        all_passed = all_passed and passed
    except Exception as e:
        print_test("GET /api/leads?sort=oldest", False, f"Error: {str(e)}")
        all_passed = False
    
    return all_passed

def test_leads_post():
    """Test POST /api/leads"""
    print("\n=== Testing Create Lead ===")
    global created_lead_id
    
    if not staff_token:
        print_test("POST /api/leads", False, "No staff token available")
        return False
    
    all_passed = True
    
    # Test with empty body (should fail with 400)
    try:
        resp = requests.post(f"{BASE_URL}/leads",
                           headers={"Authorization": f"Bearer {staff_token}"},
                           json={},
                           timeout=10)
        data = resp.json()
        passed = resp.status_code == 400 and "error" in data
        print_test("POST /api/leads (empty body → 400)", passed, f"Status: {resp.status_code}, Response: {data}")
        all_passed = all_passed and passed
    except Exception as e:
        print_test("POST /api/leads (empty body → 400)", False, f"Error: {str(e)}")
        all_passed = False
    
    # Test with valid data
    try:
        lead_data = {
            "full_name": "Test User",
            "email": "test1@example.com",
            "priority": "Warm"
        }
        resp = requests.post(f"{BASE_URL}/leads",
                           headers={"Authorization": f"Bearer {staff_token}"},
                           json=lead_data,
                           timeout=10)
        data = resp.json()
        passed = resp.status_code == 200 and "lead" in data and data["lead"].get("email") == "test1@example.com"
        if passed:
            created_lead_id = data["lead"].get("id")
            print_test("POST /api/leads (valid data)", True, f"Lead created with ID: {created_lead_id}")
        else:
            print_test("POST /api/leads (valid data)", False, f"Response: {data}")
        all_passed = all_passed and passed
    except Exception as e:
        print_test("POST /api/leads (valid data)", False, f"Error: {str(e)}")
        all_passed = False
    
    return all_passed

def test_leads_get_by_id():
    """Test GET /api/leads/:id"""
    print("\n=== Testing Get Lead by ID ===")
    
    if not admin_token:
        print_test("GET /api/leads/:id", False, "No admin token available")
        return False
    
    if not created_lead_id:
        print_test("GET /api/leads/:id", False, "No created lead ID available")
        return False
    
    try:
        resp = requests.get(f"{BASE_URL}/leads/{created_lead_id}",
                          headers={"Authorization": f"Bearer {admin_token}"},
                          timeout=10)
        data = resp.json()
        passed = resp.status_code == 200 and "lead" in data and data["lead"].get("id") == created_lead_id
        print_test("GET /api/leads/:id", passed, f"Lead retrieved: {data.get('lead', {}).get('full_name')}")
        return passed
    except Exception as e:
        print_test("GET /api/leads/:id", False, f"Error: {str(e)}")
        return False

def test_leads_put():
    """Test PUT /api/leads/:id (staff permission check)"""
    print("\n=== Testing Update Lead ===")
    
    if not staff_token or not admin_token:
        print_test("PUT /api/leads/:id", False, "Tokens not available")
        return False
    
    all_passed = True
    
    # Create a lead as admin first, then try to edit it as staff (should fail with 403)
    admin_lead_id = None
    try:
        lead_data = {
            "full_name": "Admin Created Lead",
            "email": "admin-lead@example.com",
            "priority": "Warm"
        }
        resp = requests.post(f"{BASE_URL}/leads",
                           headers={"Authorization": f"Bearer {admin_token}"},
                           json=lead_data,
                           timeout=10)
        data = resp.json()
        if resp.status_code == 200 and "lead" in data:
            admin_lead_id = data["lead"].get("id")
            print(f"   Created admin lead with ID: {admin_lead_id}")
        
        if not admin_lead_id:
            print_test("PUT /api/leads/:id (staff → 403)", False, "Failed to create admin lead")
            all_passed = False
        else:
            # Test staff editing admin's lead (should fail with 403)
            resp = requests.put(f"{BASE_URL}/leads/{admin_lead_id}",
                              headers={"Authorization": f"Bearer {staff_token}"},
                              json={"notes": "Staff trying to edit admin's lead"},
                              timeout=10)
            data = resp.json()
            passed = resp.status_code == 403 and "error" in data
            print_test("PUT /api/leads/:id (staff editing admin's lead → 403)", passed, f"Status: {resp.status_code}, Response: {data}")
            all_passed = all_passed and passed
    except Exception as e:
        print_test("PUT /api/leads/:id (staff → 403)", False, f"Error: {str(e)}")
        all_passed = False
    
    # Test staff editing their own newly-created lead (should succeed)
    if not created_lead_id:
        print_test("PUT /api/leads/:id (staff own lead)", False, "No created lead ID available")
        all_passed = False
    else:
        try:
            resp = requests.put(f"{BASE_URL}/leads/{created_lead_id}",
                              headers={"Authorization": f"Bearer {staff_token}"},
                              json={"notes": "Staff editing own lead"},
                              timeout=10)
            data = resp.json()
            passed = resp.status_code == 200 and data.get("lead", {}).get("notes") == "Staff editing own lead"
            print_test("PUT /api/leads/:id (staff own lead → 200)", passed, f"Notes updated: {data.get('lead', {}).get('notes')}")
            all_passed = all_passed and passed
        except Exception as e:
            print_test("PUT /api/leads/:id (staff own lead → 200)", False, f"Error: {str(e)}")
            all_passed = False
    
    return all_passed

def test_leads_delete():
    """Test DELETE /api/leads/:id (admin only)"""
    print("\n=== Testing Delete Lead ===")
    
    if not staff_token or not admin_token:
        print_test("DELETE /api/leads/:id", False, "Tokens not available")
        return False
    
    if not created_lead_id:
        print_test("DELETE /api/leads/:id", False, "No created lead ID available")
        return False
    
    all_passed = True
    
    # Test staff deleting (should fail with 403)
    try:
        resp = requests.delete(f"{BASE_URL}/leads/{created_lead_id}",
                             headers={"Authorization": f"Bearer {staff_token}"},
                             timeout=10)
        data = resp.json()
        passed = resp.status_code == 403 and "error" in data
        print_test("DELETE /api/leads/:id (staff → 403)", passed, f"Status: {resp.status_code}, Response: {data}")
        all_passed = all_passed and passed
    except Exception as e:
        print_test("DELETE /api/leads/:id (staff → 403)", False, f"Error: {str(e)}")
        all_passed = False
    
    # Test admin deleting (should succeed and archive)
    try:
        resp = requests.delete(f"{BASE_URL}/leads/{created_lead_id}",
                             headers={"Authorization": f"Bearer {admin_token}"},
                             timeout=10)
        data = resp.json()
        passed = resp.status_code == 200 and data.get("ok") == True
        print_test("DELETE /api/leads/:id (admin → 200)", passed, f"Response: {data}")
        
        # Verify lead is archived
        if passed:
            resp = requests.get(f"{BASE_URL}/leads/{created_lead_id}",
                              headers={"Authorization": f"Bearer {admin_token}"},
                              timeout=10)
            lead_data = resp.json()
            archived = lead_data.get("lead", {}).get("archived_at") is not None
            print_test("DELETE /api/leads/:id (archived_at set)", archived, f"archived_at: {lead_data.get('lead', {}).get('archived_at')}")
            all_passed = all_passed and archived
        else:
            all_passed = False
    except Exception as e:
        print_test("DELETE /api/leads/:id (admin → 200)", False, f"Error: {str(e)}")
        all_passed = False
    
    return all_passed

def test_leads_duplicates():
    """Test GET /api/leads/duplicates"""
    print("\n=== Testing Duplicate Detection ===")
    
    if not admin_token:
        print_test("GET /api/leads/duplicates", False, "No admin token available")
        return False
    
    try:
        resp = requests.get(f"{BASE_URL}/leads/duplicates?email=test1@example.com",
                          headers={"Authorization": f"Bearer {admin_token}"},
                          timeout=10)
        data = resp.json()
        duplicates = data.get("duplicates", [])
        # Note: The lead might be archived now, so we check if the endpoint works
        passed = resp.status_code == 200 and "duplicates" in data
        print_test("GET /api/leads/duplicates?email=test1@example.com", passed, f"Found {len(duplicates)} duplicates")
        return passed
    except Exception as e:
        print_test("GET /api/leads/duplicates", False, f"Error: {str(e)}")
        return False

def test_upload():
    """Test POST /api/upload"""
    print("\n=== Testing File Upload ===")
    
    if not admin_token:
        print_test("POST /api/upload", False, "No admin token available")
        return False
    
    try:
        # Create a tiny 1x1 PNG (base64 decoded)
        png_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        png_bytes = base64.b64decode(png_base64)
        
        files = {"image": ("test.png", io.BytesIO(png_bytes), "image/png")}
        resp = requests.post(f"{BASE_URL}/upload",
                           headers={"Authorization": f"Bearer {admin_token}"},
                           files=files,
                           timeout=10)
        data = resp.json()
        required_fields = ["url", "key", "mimeType", "size"]
        passed = resp.status_code == 200 and all(field in data for field in required_fields)
        print_test("POST /api/upload", passed, f"Upload response: url={data.get('url')}, size={data.get('size')}")
        return passed
    except Exception as e:
        print_test("POST /api/upload", False, f"Error: {str(e)}")
        return False

def test_ocr():
    """Test POST /api/ocr"""
    print("\n=== Testing OCR ===")
    
    if not admin_token:
        print_test("POST /api/ocr", False, "No admin token available")
        return False
    
    try:
        # Create a tiny 1x1 PNG
        png_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        png_bytes = base64.b64decode(png_base64)
        
        files = {"image": ("test.png", io.BytesIO(png_bytes), "image/png")}
        resp = requests.post(f"{BASE_URL}/ocr",
                           headers={"Authorization": f"Bearer {admin_token}"},
                           files=files,
                           timeout=10)
        data = resp.json()
        required_fields = ["ok", "full_name", "company", "email"]
        passed = resp.status_code == 200 and data.get("ok") == True and all(field in data for field in required_fields)
        print_test("POST /api/ocr", passed, f"OCR response: full_name={data.get('full_name')}, company={data.get('company')}")
        return passed
    except Exception as e:
        print_test("POST /api/ocr", False, f"Error: {str(e)}")
        return False

def test_export():
    """Test GET /api/leads/export (admin only)"""
    print("\n=== Testing CSV Export ===")
    
    if not staff_token or not admin_token:
        print_test("GET /api/leads/export", False, "Tokens not available")
        return False
    
    all_passed = True
    
    # Test staff access (should fail with 403)
    try:
        resp = requests.get(f"{BASE_URL}/leads/export?scope=all",
                          headers={"Authorization": f"Bearer {staff_token}"},
                          timeout=10)
        passed = resp.status_code == 403
        print_test("GET /api/leads/export (staff → 403)", passed, f"Status: {resp.status_code}")
        all_passed = all_passed and passed
    except Exception as e:
        print_test("GET /api/leads/export (staff → 403)", False, f"Error: {str(e)}")
        all_passed = False
    
    # Test admin access with scope=all
    try:
        resp = requests.get(f"{BASE_URL}/leads/export?scope=all",
                          headers={"Authorization": f"Bearer {admin_token}"},
                          timeout=10)
        passed = resp.status_code == 200 and resp.headers.get("Content-Type", "").startswith("text/csv")
        csv_content = resp.text
        has_header = "id,full_name,company" in csv_content
        print_test("GET /api/leads/export?scope=all (admin)", passed and has_header, f"CSV length: {len(csv_content)} bytes, has header: {has_header}")
        all_passed = all_passed and passed and has_header
    except Exception as e:
        print_test("GET /api/leads/export?scope=all (admin)", False, f"Error: {str(e)}")
        all_passed = False
    
    # Test admin access with scope=hot
    try:
        resp = requests.get(f"{BASE_URL}/leads/export?scope=hot",
                          headers={"Authorization": f"Bearer {admin_token}"},
                          timeout=10)
        passed = resp.status_code == 200 and resp.headers.get("Content-Type", "").startswith("text/csv")
        csv_content = resp.text
        print_test("GET /api/leads/export?scope=hot (admin)", passed, f"CSV length: {len(csv_content)} bytes")
        all_passed = all_passed and passed
    except Exception as e:
        print_test("GET /api/leads/export?scope=hot (admin)", False, f"Error: {str(e)}")
        all_passed = False
    
    return all_passed

def main():
    """Run all tests"""
    print("=" * 60)
    print("FrameX LeadFlow Backend API Test Suite")
    print("=" * 60)
    print(f"Base URL: {BASE_URL}")
    print(f"Test started at: {datetime.now().isoformat()}")
    
    results = {}
    
    # Run tests in order
    results["Root"] = test_root()
    results["Login Valid"] = test_login_valid()
    results["Login Invalid"] = test_login_invalid()
    results["Auth Me"] = test_auth_me()
    results["Events Active Get"] = test_events_active_get()
    results["Events Active Put"] = test_events_active_put()
    results["Stats"] = test_stats()
    results["Leads Get"] = test_leads_get()
    results["Leads Post"] = test_leads_post()
    results["Leads Get By ID"] = test_leads_get_by_id()
    results["Leads Put"] = test_leads_put()
    results["Leads Delete"] = test_leads_delete()
    results["Leads Duplicates"] = test_leads_duplicates()
    results["Upload"] = test_upload()
    results["OCR"] = test_ocr()
    results["Export"] = test_export()
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    print(f"Passed: {passed}/{total}")
    print(f"Failed: {total - passed}/{total}")
    
    print("\nDetailed Results:")
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {status}: {test_name}")
    
    print(f"\nTest completed at: {datetime.now().isoformat()}")
    print("=" * 60)
    
    return passed == total

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
