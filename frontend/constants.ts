
export const TTS_VOICES = [
  { name: "None", gender: "None" },
  { name: "Achernar", gender: "Female" },
  { name: "Achird", gender: "Male" },
  { name: "Algenib", gender: "Male" },
  { name: "Algieba", gender: "Female" },
  { name: "Alnilam", gender: "Female" },
  { name: "Aoede", gender: "Female" },
  { name: "Autonoe", gender: "Female" },
  { name: "Callirrhoe", gender: "Female" },
  { name: "Charon", gender: "Male" },
  { name: "Despina", gender: "Female" },
  { name: "Enceladus", gender: "Male" },
  { name: "Erinome", gender: "Female" },
  { name: "Fenrir", gender: "Female" },
  { name: "Gacrux", gender: "Female" },
  { name: "Iapetus", gender: "Male" },
  { name: "Kore", gender: "Female" },
  { name: "Laomedeia", gender: "Female" },
  { name: "Leda", gender: "Female" },
  { name: "Orus", gender: "Male" },
  { name: "Pulcherrima", gender: "Female" },
  { name: "Puck", gender: "Male" },
  { name: "Rasalgethi", gender: "Male" },
  { name: "Sadachbia", gender: "Female" },
  { name: "Sadaltager", gender: "Female" },
  { name: "Schedar", gender: "Male" },
  { name: "Sulafat", gender: "Female" },
  { name: "Umbriel", gender: "Female" },
  { name: "Vindemiatrix", gender: "Female" },
  { name: "Zephyr", gender: "Female" },
  { name: "Zubenelgenubi", gender: "Male" }
];

export const getRandomVoice = (gender: string) => {
  const pool = TTS_VOICES.filter(v => v.name !== 'None');
  const filtered = pool.filter(v => v.gender.toLowerCase() === gender.toLowerCase());
  const finalPool = filtered.length > 0 ? filtered : pool;
  return finalPool[Math.floor(Math.random() * finalPool.length)].name;
};
