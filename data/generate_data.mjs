// Synthetic demo data only. Run with Node.js: node generate_data.mjs
import { writeFileSync } from "node:fs";
let seed=20261031;
function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
const pick=a=>a[Math.floor(rand()*a.length)];
const integer=(a,b)=>a+Math.floor(rand()*(b-a+1));
const round=(n,d=2)=>Number(n.toFixed(d));
const districts=[
["Daun Penh",11.580,104.923],["Chamkar Mon",11.543,104.925],
["Toul Kork",11.579,104.898],["7 Makara",11.563,104.910],
["Chbar Ampov",11.535,104.960],["Chroy Changvar",11.601,104.945],
["Sen Sok",11.599,104.867],["Mean Chey",11.518,104.905],
["Russey Keo",11.620,104.913],["Boeng Keng Kang",11.550,104.922]];
const categories=[
["park","Garden Trail","outdoor","nature;walking;photography",0,4],
["museum","Discovery Gallery","indoor","history;culture;learning",2,12],
["art_gallery","Creative Studio","indoor","art;photography;culture",0,8],
["cafe","Courtyard Cafe","indoor","coffee;relaxing;conversation",2,8],
["food_market","Street Food Court","outdoor","food;local_culture;exploring",2,10],
["riverside","River Walk","outdoor","walking;sunset;photography",0,3],
["workshop","Craft Workshop","indoor","crafts;learning;culture",5,25],
["entertainment","Play Lounge","indoor","games;friends;competition",3,15],
["shopping","Weekend Bazaar","mixed","shopping;food;local_culture",0,5],
["wellness","Quiet Retreat","indoor","relaxing;wellness;quiet",5,20]];
const moods=["relaxed","curious","social","adventurous","romantic"];
const attractions=[];
for(let i=0;i<150;i++){
 const d=districts[i%10], c=categories[Math.floor(i/10)%10], fee=integer(c[4],c[5]);
 const food=["cafe","food_market"].includes(c[0]);
 const duration=integer(2,8)*15, open=c[0]==="food_market"?16:integer(7,10);
 const close=["cafe","food_market","entertainment"].includes(c[0])?22:18;
 attractions.push({
 attraction_id:"PP_DEMO_"+String(i+1).padStart(3,"0"),
 attraction_name:"Demo "+d[0]+" "+c[1]+" "+String(Math.floor(i/100)+1),
 city:"Phnom Penh",country:"Cambodia",district:d[0],category:c[0],
 description:"Fictional "+c[1].toLowerCase()+" in the "+d[0]+" area for "+c[3].replaceAll("; ",", ").replaceAll(";",", ")+". Suitable for a prototype itinerary; this is not a verified venue.",
 latitude:round(d[1]+(rand()-.5)*.025,6),longitude:round(d[2]+(rand()-.5)*.025,6),
 coordinates_are_approximate:true,environment:c[2],interest_tags:c[3],
 mood_tags:pick(moods)+";"+pick(moods),estimated_entry_fee_usd:food?0:fee,
 estimated_food_cost_usd:food?fee:integer(0,5),
 estimated_transport_cost_usd:integer(1,6),
 suggested_duration_minutes:duration,opening_time:String(open).padStart(2,"0")+":00",
 closing_time:close+":00",best_time_of_day:pick(["morning","afternoon","evening"]),
 family_friendly:rand()<.75,couple_friendly:rand()<.8,solo_friendly:rand()<.85,
 group_friendly:rand()<.8,wheelchair_accessible:rand()<.55,
 parking_available:rand()<.7,wifi_available:c[2]==="indoor"&&rand()<.8,
 rain_friendly:c[2]==="indoor",reservation_required:c[0]==="workshop",
 min_group_size:1,max_group_size:c[0]==="workshop"?12:30,
 typical_crowd_level:pick(["low","medium","high"]),
 activity_level:pick(["low","moderate","high"]),
 estimated_rating:round(3.2+rand()*1.7,1),synthetic_review_count:integer(10,800),
 data_source:"synthetic_demo",is_synthetic:true
 });
}
const visits=[];
for(let i=0;i<7500;i++){
 const a=attractions[i%150], mood=pick(moods),group=integer(1,8),budget=integer(5,40);
 const cost=round(a.estimated_entry_fee_usd+a.estimated_food_cost_usd+a.estimated_transport_cost_usd);
 const rain=rand()<.35,match=pick(a.interest_tags.split(";"));
 const fit=cost<=budget, sheltered=!rain||a.rain_friendly;
 const satisfaction=Math.max(1,Math.min(5,round(3+(fit?.6:-.7)+(sheltered?.3:-.5)+(rand()-.5)*1.6,1)));
 const dt=new Date(Date.UTC(2025,0,1+integer(0,364)));
 visits.push({...a,visit_id:"VISIT_"+String(i+1).padStart(5,"0"),
 synthetic_visitor_id:"USER_"+String(integer(1,1800)).padStart(4,"0"),
 visit_date:dt.toISOString().slice(0,10),visitor_age_group:pick(["18-24","25-34","35-44","45-54","55+"]),
 visitor_type:pick(["local","domestic_tourist","international_tourist"]),
 group_size:group,group_type:group===1?"solo":pick(["friends","family","couple"]),
 visitor_mood:mood,preferred_interest:match,budget_per_person_usd:budget,
 available_time_minutes:integer(2,12)*30,weather:rain?"rainy":pick(["sunny","cloudy"]),
 estimated_total_cost_per_person_usd:cost,within_budget:fit,
 actual_duration_minutes:Math.max(15,a.suggested_duration_minutes+integer(-20,40)),
 satisfaction_score:satisfaction,would_recommend:satisfaction>=3.5});
}
function csv(rows){
 const headers=Object.keys(rows[0]);
 const cell=v=>'"'+String(v).replaceAll('"','""')+'"';
 return headers.map(cell).join(",")+"\n"+rows.map(r=>headers.map(h=>cell(r[h])).join(",")).join("\n")+"\n";
}
writeFileSync(new URL("./phnom_penh_attractions.csv",import.meta.url),csv(attractions));
writeFileSync(new URL("./phnom_penh_visitor_experiences.csv",import.meta.url),csv(visits));
console.log("Created",attractions.length,"attractions and",visits.length,"visitor experiences."); 
