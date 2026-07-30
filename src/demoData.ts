import { Complaint, StationProfile, CallCenterOfficer } from "./types";

export const STATIONS: StationProfile[] = [
  { name: "Rathmalana (CWS)", code: "Rathmalana", passwordHash: "rathmalana123", managerName: "Kusal Silva", email: "rathmalana.cws@idealgroup.lk", phone: "+94 11 263 4455" },
  { name: "Wanawasala", code: "Wanawasala", passwordHash: "wanawasala123", managerName: "Amila Fernando", email: "wanawasala.station@idealgroup.lk", phone: "+94 11 291 3322" },
  { name: "Yakkala", code: "Yakkala", passwordHash: "yakkala123", managerName: "Dhanushka Perera", email: "yakkala.station@idealgroup.lk", phone: "+94 33 222 1100" },
  { name: "Kurunegala", code: "Kurunegala", passwordHash: "kurunegala123", managerName: "Sunil Bandara", email: "kurunegala.station@idealgroup.lk", phone: "+94 37 223 4455" },
  { name: "Anuradhapura", code: "Anuradhapura", passwordHash: "anuradhapura123", managerName: "Rohan Jayasuriya", email: "anuradhapura.station@idealgroup.lk", phone: "+94 25 222 3344" },
  { name: "Jaffna", code: "Jaffna", passwordHash: "jaffna123", managerName: "T. Selvakumar", email: "jaffna.station@idealgroup.lk", phone: "+94 21 222 5566" },
  { name: "Tissamaharama", code: "Tissamaharama", passwordHash: "tissamaharama123", managerName: "Chinthaka Weerasinghe", email: "tissamaharama.station@idealgroup.lk", phone: "+94 47 223 9988" }
];

export const CALL_CENTER_OFFICERS: CallCenterOfficer[] = [
  {
    id: "CC-101",
    name: "Usha",
    title: "Senior CX Call Center Executive",
    email: "usha@idealgroup.lk",
    phone: "+94 77 111 2233",
    avatar: "US",
    department: "Ideal Motors Central CX Call Center"
  },
  {
    id: "CC-102",
    name: "Irshana",
    title: "CX Resolution Specialist",
    email: "irshana@idealgroup.lk",
    phone: "+94 77 222 3344",
    avatar: "IR",
    department: "Ideal Motors Central CX Call Center"
  },
  {
    id: "CC-103",
    name: "Yathish",
    title: "Aftermarket Follow-Up Officer",
    email: "yathish@idealgroup.lk",
    phone: "+94 77 333 4455",
    avatar: "YA",
    department: "Ideal Motors Central CX Call Center"
  },
  {
    id: "CC-104",
    name: "Pawani",
    title: "Customer Verification Executive",
    email: "pawani@idealgroup.lk",
    phone: "+94 77 444 5566",
    avatar: "PA",
    department: "Ideal Motors Central CX Call Center"
  },
  {
    id: "CC-105",
    name: "Shevon",
    title: "Call Center Operations Lead",
    email: "shevon@idealgroup.lk",
    phone: "+94 77 555 6677",
    avatar: "SH",
    department: "Ideal Motors Central CX Call Center"
  }
];


export const DEMO_COMPLAINTS: Complaint[] = [
  {
    id: "COMP-101",
    customerName: "Kamal Perera",
    customerPhone: "+94 77 123 4567",
    customerEmail: "kamal.perera@gmail.com",
    station: "Rathmalana",
    category: "Service Delay",
    description: "Brought my vehicle in for regular 10,000 km maintenance at 8:30 AM. I was promised that it would be ready by 11:30 AM. However, I was made to wait in the lounge until 3:00 PM without any update or explanation. This delayed all my afternoon business appointments. Extremely unprofessional timing.",
    date: "2026-06-20",
    receivedDateTime: "2026-06-20 08:30 AM",
    initialSatisfaction: "Very Dissatisfied",
    currentSatisfaction: "Very Dissatisfied",
    status: "Pending",
    notes: "",
    agentName: ""
  },
  {
    id: "COMP-102",
    customerName: "Anura de Silva",
    customerPhone: "+94 71 987 6543",
    customerEmail: "anura.desilva@yahoo.com",
    station: "Wanawasala",
    category: "Quality of Work",
    description: "Paid over LKR 45,000 for a full engine tune-up because of an engine rattle noise. After driving out of the service station, the rattle noise is still exactly the same. It feels like the technicians didn't even look at the engine or diagnose the issue properly. I paid for nothing.",
    date: "2026-06-21",
    receivedDateTime: "2026-06-21 09:15 AM",
    initialSatisfaction: "Dissatisfied",
    currentSatisfaction: "Dissatisfied",
    status: "In Progress",
    notes: "Assigned vehicle check to senior mechanic. Contacted customer to arrange a re-inspection date.",
    agentName: "Nishantha Fernando"
  },
  {
    id: "COMP-103",
    customerName: "Dilini Senanayake",
    customerPhone: "+94 72 456 7890",
    customerEmail: "dilini.sena@outlook.com",
    station: "Yakkala",
    category: "Billing Dispute",
    description: "I was given an initial estimate of LKR 18,000 for brake pad replacement. When checking out, the bill was LKR 32,000! They claimed they had to change additional clips and pins without calling me to obtain prior approval. This is dishonest pricing.",
    date: "2026-06-22",
    receivedDateTime: "2026-06-22 11:45 AM",
    initialSatisfaction: "Very Dissatisfied",
    currentSatisfaction: "Very Dissatisfied",
    status: "Pending",
    notes: "",
    agentName: ""
  },
  {
    id: "COMP-104",
    customerName: "Ranjith Fernando",
    customerPhone: "+94 76 333 4444",
    customerEmail: "ranjith.f@gmail.com",
    station: "Tissamaharama",
    category: "Staff Behavior",
    description: "The service adviser at Tissamaharama station was extremely impolite. When I tried to explain the steering vibration issue, he cut me off and said 'we know what to do' in a very rude tone. Throughout my visit, he was unwelcoming and didn't greet or explain anything.",
    date: "2026-06-23",
    receivedDateTime: "2026-06-23 02:20 PM",
    initialSatisfaction: "Dissatisfied",
    currentSatisfaction: "Neutral",
    status: "Contacted",
    notes: "Called Mr. Ranjith. Apologized on behalf of the station management. Informed him we are conducting internal customer care training for the Tissamaharama advisor team.",
    agentName: "Priyantha Bandara"
  },
  {
    id: "COMP-105",
    customerName: "Muthu Ramanathan",
    customerPhone: "+94 75 555 6666",
    customerEmail: "muthu.ram@hotmail.com",
    station: "Jaffna",
    category: "Vehicle Damage/Dirt",
    description: "I received my car back after body washing, and there were greasy black stains all over the beige leather driver seat and the steering wheel cover. It shows the mechanics didn't use seat protectors. My car interior was pristine before this.",
    date: "2026-06-24",
    receivedDateTime: "2026-06-24 10:10 AM",
    initialSatisfaction: "Very Dissatisfied",
    currentSatisfaction: "Very Dissatisfied",
    status: "Pending",
    notes: "",
    agentName: ""
  },
  {
    id: "COMP-106",
    customerName: "Sahan Gunawardena",
    customerPhone: "+94 77 777 8888",
    customerEmail: "sahan.guna@idealgroup.lk",
    station: "Kurunegala",
    category: "Quality of Work",
    description: "The air conditioning was cooling perfectly fine before servicing. However, after the general body wash and interior vacuum, the AC is blowing warm air only. I suspect something was damaged or disconnected during the vacuum process.",
    date: "2026-06-18",
    receivedDateTime: "2026-06-18 04:05 PM",
    initialSatisfaction: "Dissatisfied",
    currentSatisfaction: "Satisfied",
    status: "Resolved",
    notes: "Discovered that the AC compressor switch wire had come loose during interior cleaning. Reconnected the wire immediately, tested cooling levels, and offered a free car wax voucher. Customer was very happy with the quick response.",
    agentName: "Mahela Jayasundara"
  },
  {
    id: "COMP-107",
    customerName: "Sunil Shantha",
    customerPhone: "+94 71 555 4321",
    customerEmail: "sunil.sh@outlook.com",
    station: "Anuradhapura",
    category: "Service Delay",
    description: "Scheduled my tractor service for 9:00 AM, but was informed they ran out of oil filters. Had to wait for parts to arrive from another branch. Left at 4:30 PM. Complete waste of my farming day.",
    date: "2026-06-23",
    receivedDateTime: "2026-06-23 09:00 AM",
    initialSatisfaction: "Dissatisfied",
    currentSatisfaction: "Dissatisfied",
    status: "Pending",
    notes: "",
    agentName: ""
  }
];
