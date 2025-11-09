Farmlink Frontend Sprint Plan
Project: Farmlink Frontend Repository: /frontend (React + Vite) Team: Dev 3 (Verifier UI), Dev 4 (Farmer UI) Goal: Build the "Golden Path" UI for the 3-day demo.

1. What's Already Done (Current Status)
The /frontend app is currently a functional Farmer Onboarding application.

[x] Core Libs: react, react-router-dom, supabase-js, leaflet, leaflet-draw, react-leaflet-draw, @tmcw/togeojson, react-dropzone are all installed and configured.

[x] User Authentication: The entire auth flow is 100% complete.

signup.jsx: User signup with full_name and role.

login.jsx: User login with email/password.

protected.jsx: All dashboard routes are correctly protected.

[x] Farmer Dashboard (Shell): A functional dashboard page (dashboard.jsx) exists. It correctly fetches the user's name from the profiles table and has a working logout button.

[x] Farm Creation (100% Done): The "Add New Farm" flow is complete.

The modal on the dashboard works.

createfarm.jsx: Users can successfully draw a polygon on a map and save it to the farms table.

kmlpage.jsx: Users can successfully upload a KML file, preview it, and save it to the farms table.

2. "Must-Have" Sprint Tasks (The Golden Path)
This is the non-negotiable work for our 3-day demo.

Core App Structure (Dev 3)
[ ] Task: Implement Role-Based Redirects.

File: login.jsx (on success) or protected.jsx.

Logic: After login, read the role from the profiles table.

If role === 'farmer', navigate to /home.

If role === 'verifier', navigate to /verifier-dashboard.

[ ] Task: Add New Verifier Routes.

File: App.jsx.

Logic: Add two new ProtectedRoute routes:

/verifier-dashboard (renders <VerifierDashboard />)

/verify/:milestone_id (renders <VerificationDetailPage />)

Farmer Flow Updates (Dev 4)
[ ] Task: Gut Mock Data from Farmer Dashboard.

File: dashboard.jsx.

Logic: Remove the static HTML for "Upcoming Milestones" and "Payment Status".

[ ] Task: Fetch and Display Real Milestones.

File: dashboard.jsx.

Logic:

Fetch all farms for the current user.id.

For those farms, fetch all milestones from the new milestones table.

Render this list of real milestones, showing name, due_date, and status.

[ ] Task: Create the "Submit Proof" Component.

File: Create SubmitProofModal.jsx.

Logic:

This component is triggered by a "Submit" button on a pending milestone.

It uses react-dropzone (already installed) to upload one photo to Supabase Storage.

On successful upload, it must call the submitMilestoneEdge Edge Function, passing the milestone_id and the file_url it received from Storage.

Verifier Flow (The "Money Shot") (Dev 3)
[ ] Task: Build the Verifier Dashboard (Queue).

File: Create VerifierDashboard.jsx.

Logic:

Fetch all milestones from the milestones table where status === 'submitted'.

Display this as a simple queue (e.g., "Farm: Green Valley - Milestone: Germination - Submitted: 10:30 AM").

Make each item a link to /verify/[milestone_id].

[ ] Task: Build the Verification Detail Page.

File: Create VerificationDetailPage.jsx.

Logic: This is the most important screen for the demo.

Use useParams to get the milestone_id from the URL.

Fetch the milestone data.

Fetch the related evidence from milestone_evidence (where milestone_id matches).

Display the Farmer's Photo (using the file_url).

Display the AI Verdict: Parse the agro_augmentation JSONB data from the milestone row. Display the ai_verdict and confidence fields in a "Verification" box.

Add "Approve" Button: Create an "Approve" button that, when clicked, calls the triggerPayment Edge Function.

3. "Bonus" Features (If Time Allows)
Do not attempt these until all "Must-Have" tasks are 100% functional.

[ ] Task: Mock Satellite & IoT Data (Dev 4).

File: VerificationDetailPage.jsx.

Logic: Add static components that look real.

Hard-code a simple line chart (using an array of numbers) and label it "Soil Moisture (IoT Data)" .

Add a static .jpg image of an NDVI map and label it "AgroMonitoring Satellite Data".

[ ] Task: Implement Realtime Updates (Dev 3).

File: VerifierDashboard.jsx.

Logic: Use Supabase's Realtime on() function to listen for INSERT or UPDATE events on the milestones table. When an event fires, refresh the list of pending milestones.

[ ] Task: Fix Farm Creation (jsonb to geom) (Dev 4).

File: createfarm.jsx and kmlpage.jsx.

Logic: The current code saves location_data as a simple JSON array. This task is to update the insert call to correctly format and save this data as a PostGIS geom object, per our final schema. This is a technical debt task.