export const dateLabel=(date:string)=>new Date(date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
