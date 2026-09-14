import type {User, Reflection, Message} from '../../types';
export const users:User[] = [
 {id:'ananya',name:'Ananya Sharma',initials:'AS',context:'Personal wellbeing',status:'Monitoring',trend:'Improving',summary:'Daily responsibilities have felt demanding. Recent continuity suggests more room for rest and connection.'},
 {id:'rohan',name:'Rohan Menon',initials:'RM',context:'Personal wellbeing',status:'Increasing concern',trend:'Worsening',summary:'Work and personal demands have continued across recent check-ins. A personal follow-up may be helpful.'},
 {id:'isha',name:'Isha Patel',initials:'IP',context:'Personal wellbeing',status:'Stable',trend:'No clear change',summary:'A steady routine and regular connection with friends have continued.'}
];
export const reflections:Reflection[] = [
 {id:'seed-1',date:'2026-09-13T16:30:00+05:30',mode:'Written',observation:'Making space for yourself alongside daily responsibilities.',raw:'I finally took a walk with a friend after a busy day. It helped to step away for a little while.'},
 {id:'seed-2',date:'2026-09-10T18:10:00+05:30',mode:'Voice',observation:'Finding small moments of connection in a busy week.',raw:'Sample voice reflection: Things have been busy, but I made time to call home today.'},
 {id:'seed-3',date:'2026-09-07T17:00:00+05:30',mode:'Written',observation:'Noticing the demands of a new week.',raw:'There are a few responsibilities to manage this week. I am trying to take them one at a time.'}
];
export const messages:Message[] = [{id:'msg-1',userId:'ananya',sender:'supervisor',text:'Hi Ananya, just checking in. How has your week been? We can make some time to talk if you’d like.',date:'2026-09-14T09:15:00+05:30'}];
