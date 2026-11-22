import { test, expect } from '@playwright/test';
const patient={id:'test-patient',name:'Authorised patient',mean_score:50};
const session={id:'test-session',started_at:'2026-11-22T10:00:00Z',ended_at:'2026-11-22T10:10:00Z',mean_score:50,turn_count:1};
test.beforeEach(async({page})=>{
 await page.route('**/api/auth/session',r=>r.fulfill({json:{user:{id:'consultant',email:'c@example.test',role:'supervisor'},csrfToken:'test'}}));
 await page.route('**/consultant/notifications',r=>r.fulfill({json:{requests:[],alerts:[],unread_count:0}}));
});
test('empty consultant has no invented records or notification badge',async({page})=>{
 await page.route('**/consultant/patients',r=>r.fulfill({json:{patients:[]}}));
 await page.goto('/supervisor');await expect(page.getByText('No patients assigned yet.')).toBeVisible();
 await expect(page.locator('.notification-count')).toHaveCount(0);await expect(page.getByText('0 Patients')).toBeVisible();
});
test('selection shows graph above saved report without tabs and clears when patient changes',async({page})=>{
 await page.route('**/consultant/patients',r=>r.fulfill({json:{patients:[patient,{...patient,id:'second',name:'Second patient'}]}}));
 await page.route('**/patients/*/sessions',r=>r.fulfill({json:{sessions:[session]}}));
 await page.route('**/sessions/test-session',r=>r.fulfill({json:{...session,graph_available:false,report:{summary:'Saved clinician summary',timeline:[]}}}));
 await page.goto('/supervisor');await page.getByRole('button',{name:/Authorised patient/}).click();await page.getByRole('button',{name:/Session 1/}).click();
 await expect(page.getByText('Saved clinician summary')).toBeVisible();await expect(page.getByRole('tab')).toHaveCount(0);
 const graph=await page.getByRole('heading',{name:'Mental State Graph'}).boundingBox();const report=await page.getByRole('heading',{name:'Session Report',exact:true,level:3}).boundingBox();expect(graph!.y).toBeLessThan(report!.y);
 await page.getByRole('button',{name:/Second patient/}).click();await expect(page.getByText('No session selected.')).toBeVisible();await expect(page.getByText('Saved clinician summary')).toHaveCount(0);
});
test('notification decisions call server then refresh real count',async({page})=>{
 let approved=false;
 await page.route('**/consultant/patients',r=>r.fulfill({json:{patients:approved?[patient]:[]}}));
 await page.route('**/consultant/notifications',r=>r.fulfill({json:{requests:[{request_id:'req',display_identifier:'Applicant',created_at:session.started_at,status:approved?'accepted':'pending'}],alerts:[],unread_count:approved?0:1}}));
 await page.route('**/requests/req/decision',r=>{expect(r.request().postDataJSON()).toEqual({accept:true});approved=true;return r.fulfill({json:{status:'accepted'}});});
 await page.goto('/supervisor/notifications');await page.getByRole('button',{name:'Accept',exact:true}).click();await expect(page.getByText('accepted',{exact:true})).toBeVisible();await expect(page.locator('.notification-count')).toHaveCount(0);
 await page.getByRole('link',{name:'Back to patients'}).click();await expect(page.getByRole('button',{name:/Authorised patient/})).toBeVisible();
});
for(const width of [1440,844,390])test(`consultant layout fits ${width}`,async({page})=>{
 await page.setViewportSize({width,height:800});await page.route('**/consultant/patients',r=>r.fulfill({json:{patients:[]}}));await page.goto('/supervisor');await expect(page.getByText('No patients assigned yet.')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
