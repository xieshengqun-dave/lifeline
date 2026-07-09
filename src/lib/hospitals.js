// Curated Klang Valley hospitals for the destination/pickup picker — same
// spirit as the backend's seeded operator list: real hospitals, coordinates
// verified via web search where noted, otherwise plausible town-area
// estimates (not survey-precise). Refine further once real usage patterns
// (or a real Places Autocomplete integration) make it worth the API key.
//
// Originally clustered around KL/PJ/Subang/Damansara only — missed Klang,
// Shah Alam, and Cheras entirely (a real gap: 2 of the 5 seeded operators
// are based in Shah Alam and Cheras). Added below after a user report that
// searching "Klang" returned nothing.
export const HOSPITALS = [
  { name: "Thomson Hospital Kota Damansara", latitude: 3.1631, longitude: 101.5892 },
  { name: "Sunway Medical Centre", latitude: 3.0654, longitude: 101.6008 },
  { name: "Gleneagles Kuala Lumpur", latitude: 3.161, longitude: 101.7183 },
  { name: "Pantai Hospital Kuala Lumpur", latitude: 3.119, longitude: 101.666 },
  { name: "Prince Court Medical Centre", latitude: 3.1571, longitude: 101.7127 },
  { name: "KPJ Damansara Specialist Hospital", latitude: 3.1478, longitude: 101.6206 },
  { name: "Subang Jaya Medical Centre", latitude: 3.0819, longitude: 101.5847 },
  { name: "Assunta Hospital", latitude: 3.1073, longitude: 101.6067 },
  { name: "Hospital Kuala Lumpur", latitude: 3.1729, longitude: 101.7016 },
  { name: "Ara Damansara Medical Centre", latitude: 3.1153, longitude: 101.5857 },
  { name: "Columbia Asia Petaling Jaya", latitude: 3.093, longitude: 101.606 },
  // Klang
  { name: "Hospital Tengku Ampuan Rahimah, Klang", latitude: 3.0203, longitude: 101.4408 }, // web-verified
  { name: "KPJ Klang Specialist Hospital", latitude: 3.041, longitude: 101.438 }, // estimated, Bandar Baru Klang
  // Shah Alam
  { name: "Hospital Shah Alam", latitude: 3.0757, longitude: 101.4933 }, // web-verified
  { name: "KPJ Selangor Specialist Hospital, Shah Alam", latitude: 3.052, longitude: 101.51 }, // estimated, Seksyen 20
  // Cheras
  { name: "Columbia Asia Hospital, Cheras", latitude: 3.031525, longitude: 101.762945 }, // web-verified
];
