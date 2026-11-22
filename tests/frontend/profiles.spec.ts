import { test, expect } from '@playwright/test';
const patient={name:'Registered user',text:'',photo_available:false,supervisor:null,assignment_status:'pending'};
const consultant={name:'Registered consultant',email:'consultant@example.test',text:'',consultant_id:'verified-id',patient_count:0,photo_available:false};
async function identity(page: import('@playwright/test').Page, role='patient') {
 await page.route('**/api/auth/session',r=>r.fulfill({json:{user:{id:'verified-account',role,email:'account@example.test'},csrfToken:'test-token'}}));
}
test('patient personalization persists through reload, no implicit save',async({page})=>{
 await identity(page);let saved={...patient};let calls=0;
 await page.route('**/profiles/patient',r=>{if(r.request().method()==='POST'){calls++;const body=r.request().postDataJSON();saved={...saved,name:body.name,text:body.text};}return r.fulfill({json:saved});});
 await page.goto('/patient/profile');await expect(page.getByText('account@example.test')).toBeVisible();await expect(page.getByText('Awaiting consultant approval.')).toBeVisible();
 await page.getByLabel('Personalization text').fill('My saved background');expect(calls).toBe(0);
 await expect(page.getByText('19 / 2000')).toBeVisible();await page.getByRole('button',{name:'Save Changes'}).click();await expect(page.getByRole('status')).toHaveText('Changes saved.');
 await page.reload();await expect(page.getByLabel('Personalization text')).toHaveValue('My saved background');
 await page.getByLabel('Personalization text').fill('Unsaved edit');await page.reload();await expect(page.getByLabel('Personalization text')).toHaveValue('My saved background');
});
test('consultant details, real count, copy, description and no settings',async({page,context})=>{
 await identity(page,'supervisor');let saved={...consultant};await context.grantPermissions(['clipboard-read','clipboard-write']);
 await page.route('**/profiles/consultant',r=>{if(r.request().method()==='POST') saved={...saved,...r.request().postDataJSON()};return r.fulfill({json:saved});});
 await page.goto('/supervisor/profile');await expect(page.getByText('0 Patients')).toBeVisible();await expect(page.getByText('Account Settings',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Copy Consultant ID'}).first().click();expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe('verified-id');
 await page.getByLabel('About You (for Patient Matching)').fill('My professional background');await page.getByRole('button',{name:'Save Changes'}).click();await expect(page.getByRole('status')).toHaveText('Changes saved.');await page.reload();await expect(page.getByLabel('About You (for Patient Matching)')).toHaveValue('My professional background');
});
test('photo preview, save and persistent reload; invalid type rejected',async({page})=>{
 await identity(page);let hasPhoto=false;
 await page.route('**/profiles/patient',r=>r.fulfill({json:{...patient,photo_available:hasPhoto}}));
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
 await page.route('**/profiles/patient/photo*',r=>{if(r.request().method()==='POST'){hasPhoto=true;return r.fulfill({json:{status:'saved'}});}return r.fulfill({body:png,contentType:'image/png'});});
 await page.goto('/patient/profile');await page.getByLabel('Change profile photo').setInputFiles({name:'bad.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')});await expect(page.getByRole('alert')).toContainText('JPEG');
 await page.getByLabel('Change profile photo').setInputFiles({name:'photo.png',mimeType:'image/png',buffer:png});await expect(page.getByAltText('New profile photo preview')).toBeVisible();expect(hasPhoto).toBe(false);await page.getByRole('button',{name:'Save Photo'}).click();await expect(page.getByText('Photo saved.')).toBeVisible();await page.reload();await expect(page.getByAltText('Your saved profile photo')).toBeVisible();
});
test('save failures preserve the draft and never confirm success',async({page})=>{
 await identity(page);await page.route('**/profiles/patient',r=>r.request().method()==='POST'?r.fulfill({status:503,json:{}}):r.fulfill({json:patient}));await page.goto('/patient/profile');await page.getByLabel('Personalization text').fill('Keep my draft');await page.getByRole('button',{name:'Save Changes'}).click();await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByLabel('Personalization text')).toHaveValue('Keep my draft');await expect(page.getByText('Changes saved.')).toHaveCount(0);
});
for(const width of [1440,844,390])test(`both profiles fit ${width}`,async({page})=>{
 await page.setViewportSize({width,height:900});for(const role of ['patient','supervisor']){await identity(page,role);await page.route('**/profiles/'+(role==='patient'?'patient':'consultant'),r=>r.fulfill({json:role==='patient'?patient:consultant}));await page.goto('/'+role+'/profile');await expect(page.getByRole('button',{name:'Save Changes'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.getByRole('link',{name:'Back to Dashboard'})).toBeVisible();}
});
