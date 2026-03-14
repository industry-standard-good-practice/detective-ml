
export const TTS_VOICES = [
  { name: "None", gender: "None" },
  { name: "Achernar", gender: "Female" },
  { name: "Achird", gender: "Male" },
  { name: "Algenib", gender: "Male" },
  { name: "Algieba", gender: "Male" },
  { name: "Alnilam", gender: "Male" },
  { name: "Aoede", gender: "Female" },
  { name: "Autonoe", gender: "Female" },
  { name: "Callirrhoe", gender: "Female" },
  { name: "Charon", gender: "Male" },
  { name: "Despina", gender: "Female" },
  { name: "Enceladus", gender: "Male" },
  { name: "Erinome", gender: "Female" },
  { name: "Fenrir", gender: "Male" },
  { name: "Gacrux", gender: "Female" },
  { name: "Iapetus", gender: "Male" },
  { name: "Kore", gender: "Female" },
  { name: "Laomedeia", gender: "Female" },
  { name: "Leda", gender: "Female" },
  { name: "Orus", gender: "Male" },
  { name: "Pulcherrima", gender: "Female" },
  { name: "Puck", gender: "Male" },
  { name: "Rasalgethi", gender: "Male" },
  { name: "Sadachbia", gender: "Male" },
  { name: "Sadaltager", gender: "Male" },
  { name: "Schedar", gender: "Male" },
  { name: "Sulafat", gender: "Female" },
  { name: "Umbriel", gender: "Male" },
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
