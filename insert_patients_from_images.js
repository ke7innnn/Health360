const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load env
const envFile = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim();
  }
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const rawData = [
  // Image 1
  ["Clarissa Godinho", "43 years", "female", "9820934039"],
  ["Caral Docterzz", "1 year 5 m", "female", "9867911550"],
  ["Ashish Helegaonkar", "39 years", "male", "8007330959"],
  ["Akshata Bhosale", "25 years", "female", "7798235654"],
  ["Rohan Manake", "26 years", "male", "9579658937"],
  ["Anjana Shah", "74 years", "female", "9022334647"],
  ["Nirmala Khanna", "62 years", "female", "9730325155"],
  ["Anita Kapoor", "69 years", "female", "9272785077"],
  ["Sanjay Patil", "68 years", "male", "9730359204"],
  ["Rohan Salvi", "25 years", "male", "9049344464"],
  ["Berndette Gaikwad", "27 years", "female", "8149685790"],
  ["Namita Amare", "30 years", "female", "8454027909"],
  ["Ekta Mirgal", "30 years", "female", "8551022674"],
  ["Anita Jagtap", "55 years", "female", "7900196922"],
  ["Pooja Bhosale", "22 years", "female", "8698141027"],
  ["Aparna More", "50 years", "female", "9325260732"],
  ["Aarti Prabhu", "77 years", "female", "8390611817"],
  ["Priyanka Yadav", "34 years", "female", "9022381929"],
  ["Rahul Yadav", "28 years", "male", "8421431180"],
  ["Farhad Shaikh", "56 years", "female", "7499655459"],
  ["Michelle D'silva", "44 years", "female", "9892828532"],
  ["Rizwin Shaikh", "37 years", "female", "9561789222"],
  ["Mihir Joshi", "21 years", "male", "7499880319"],
  ["Anushka Kulkarni", "42 years", "female", "9869702370"],
  ["Emelia Dias", "69 years", "female", "9226162229"],
  ["Sanjay Varun", "24 years", "male", "9579222490"],
  ["Ruby Shaikh", "28 years", "female", "7507173609"],
  ["Suraj Sutar", "33 years", "male", "9619079336"],
  ["Savio Mathias", "35 years", "male", "9029135761"],
  ["Arun Nair", "43 years", "male", "9881141319"],
  ["Dayavathi Suvarna", "62 years", "female", "8412890862"],
  ["Nalini Dongre", "64 years", "female", "8087440813"],
  ["Asha Balmiki", "51 years", "female", "9730273317"],
  
  // Image 2
  ["Deepa Abhange", "39 years", "female", "9762575090"],
  ["Aishwarya Sharma", "29 years", "female", "9399965907"],
  ["Shehnaz Bhimani", "57 years", "female", "8007306303"],
  ["Ekta Mirgal", "30 years", "female", "855012267"],
  ["Shivangi Soni", "30 years", "female", "8446369277"],
  ["Dharmendra Kantaria", "59 years", "male", "8669683556"],
  ["Baby Aarvi", "2 years 6", "female", "7908159029"],
  ["Anuja Mate", "28 years", "female", "8600582485"],
  ["Rajita Mhapalkar", "51 years", "female", "7058736367"],
  ["Ishani Joshi", "60 years", "female", "9168526267"],
  ["Smit Gangekar", "16 years", "female", "9764733433"],
  ["Sana Shaikh", "32 years", "female", "6386247113"],
  ["Vinaya Inamdar", "50 years", "female", "7507031385"],
  ["Sumitra Bhosale", "42 years", "female", "9370745407"],
  ["Suraj Amare", "30 years", "male", "7021355998"],
  ["Krishna Gaikwad", "37 years", "male", "8087343369"],
  ["Rohit Dhumal", "26 years", "male", "7775857640"],
  ["Manisha Deve", "39 years", "female", "9029398190"],
  ["Vijay Malushte", "69 years", "female", "7972980295"],
  ["Joel D'souza", "29 years", "male", "8007655692"],
  ["Sarita Sinha", "48 years", "female", "9930082872"],
  ["Mohan Amare", "62 years", "male", "8208622358"],
  ["Rahul Dhatrak", "30 years", "male", "9860326925"],
  ["Tauseef Khan", "44 years", "male", "8263931370"],
  ["Megh Raut", "20 years", "male", "7058598952"],
  ["Kuldeep Singh", "31 years", "male", "7790930723"],
  ["Kasturi Panchal", "70 years", "female", "9423354470"],
  ["K", "15 days", "male", "8698930978"],
  ["Mitansh Kiran Chaudhari", "6 years 2", "male", "9423476192"],
  ["Priya Bhagve", "45 years", "female", "8087850178"],
  ["Arun Chopade", "70 years", "male", "9029948756"],
  ["Rashmita", "36 years", "female", "8482812859"],
  ["Vaishali Patil", "45 years", "female", "9136898161"],
  ["Ajay More", "52 years", "male", "7507678717"],
  ["Neha Modale", "57 years", "female", "9637765476"],
  ["Ayesha Memon", "77 years", "female", "8698701919"],
  ["Prakash Doshi", "65 years", "male", "9967334722"],
  ["Amol Patil", "50 years", "male", "9923883637"],
  ["Mann Doshi", "11 years", "male", "8669102917"],
  
  // Image 3
  ["Shaista Memon", "48 years", "female", "9028786500"],
  ["Sindhu Nair", "39 years", "female", "9860356989"],
  ["Vipul Joshi", "56 years", "male", "9320204506"],
  ["Lydia Verghese", "33 years", "female", "9867345348"],
  ["Noyal Nixon", "22 years", "male", "9175913968"],
  ["Swapnali Kansara", "52 years", "female", "8454945361"],
  ["Rajni Jijo", "38 years", "female", "9819316607"],
  ["Ramesh Panchal", "55 years", "male", "8459178360"],
  ["Pansy Rodrigues", "68 years", "female", "7506008907"],
  ["Meenakshi Jadhav", "38 years", "female", "9766075750"],
  ["Pratim Gupta", "45 years", "female", "7798865598"],
  ["Sweta Kanhat", "31 years", "female", "8788230532"],
  ["Jenifer Coutinho", "69 years", "female", "7276701084"],
  ["Marlin Rodrigues", "43 years", "female", "7506008907"],
  ["Akansha Maurya", "29 years", "female", "8530212444"],
  ["Asha Dubey", "55 years", "female", "8957001874"],
  ["Vani Chitnis", "50 years", "female", "9767982452"],
  ["Trupti Patil", "42 years", "female", "7038823733"],
  ["Saili Kanhat", "26 years", "female", "8530533615"],
  ["Surekha Kanhat", "52 years", "female", "8530533605"],
  ["Pooja Malushte", "62 years", "female", "9892917242"],
  ["Saddam Lakha", "35 years", "male", "7756897500"],
  ["Rekha Pandey", "45 years", "female", "9224301662"],
  ["Prabhakar Shetty", "61 years", "male", "8208627950"],
  ["Sunita Jha", "52 years", "female", "9560694821"],
  ["Kennice Dabreo", "20 years", "female", "9511635945"],
  ["Manisha Joshi", "52 years", "female", "9766528068"],
  ["Arwa Agashiwala", "37 years", "female", "9561192752"],
  ["Kamlaben Panchal", "67 years", "female", "9619639013"],
  ["Rinku Ghosh", "47 years", "female", "9768552164"],
  ["Rajni Prajapati", "50 years", "female", "7905194481"],
  ["Shridhar Devadiga", "36 years", "male", "9833956756"],
  ["Sapna Mundapat", "50 years", "female", "9320050118"],
  ["Alan Rodrigues", "55 years", "male", "7507284946"],
  ["Smita Bangera", "57 years", "female", "9022349511"],
  ["Dr. Madhavi Deshpande", "57 years", "female", "93228088733"],
  ["Kaushlendra Tiwari", "54 years", "male", "9028674054"],
  ["Renuka Bhatt", "53 years", "female", "9923899883"],
  ["Vaishali Ingole", "40 years", "female", "9320036910"],
  
  // Image 4
  ["Neha Sawant", "28 years", "female", "7208668158"],
  ["Aniket Sawant", "25 years", "male", "9004205311"],
  ["Ranjeta Boban", "45 years", "female", "8369603927"],
  ["Radha Giri", "50 years", "female", "9415543812"],
  ["Saraswati Rawal", "47 years", "female", "9529794241"],
  ["Kaushal Pandey", "19 years", "male", "9320178811"],
  ["Sunil Jagtap", "50 years", "male", "9975317374"],
  ["Kamala Chandak", "63 years", "female", "8956568924"],
  ["Mamta Doshi", "40 years", "female", "9518784504"],
  ["C.P.Tiwari", "70 years", "male", "9673469886"],
  ["Suraj Pawar 1", "46 years", "male", "7304624808"],
  ["Maya Talekar", "50 years", "female", "9890212925"],
  ["Kiran Vyas", "49 years", "female", "8830468879"],
  ["Sunita Alloor", "52 years", "female", "7709083213"],
  ["Mahindra Bhavsar", "48 years", "male", "8291306151"],
  ["Daksha Upadhay", "71 years", "female", "9529646544"],
  ["Amey Desai", "40 years", "male", "7709480669"],
  ["Kalpesh Bhamare", "28 years", "male", "7517310789"],
  ["Vanita Bharti", "54 years", "female", "8644924870"],
  ["Baptis Moras", "45 years", "female", "9767566582"],
  ["Garima Singh", "60 years", "female", "9930749055"],
  ["Tejas Sherigar", "25 years", "male", "7558521391"],
  ["Vaishali Mehta", "67 years", "female", "8767763550"],
  ["Rita Vanmali", "63 years", "female", "7666170620"],
  ["Paresh Purohit8", "31 years", "male", "9920317411"],
  ["Aarti Falorh", "43 years", "female", "9819797589"]
];

async function insertData() {
  const allPatients = rawData.map(row => ({
    patient_name: row[0].trim(),
    age: row[1].replace(' years', '').replace(' year', '').trim(),
    contact: row[3].trim(),
    patient_type: 'General'
  })).filter(p => p.contact);

  const uniquePatients = new Map();
  for (const p of allPatients) {
    if (!uniquePatients.has(p.contact)) {
      uniquePatients.set(p.contact, p);
    }
  }
  const patientsToInsert = Array.from(uniquePatients.values());

  console.log(`Prepared ${patientsToInsert.length} unique patients for insertion (down from ${allPatients.length}).`);

  const { data, error } = await supabase
    .from('patients')
    .upsert(patientsToInsert, { onConflict: 'contact' });

  if (error) {
    console.error('Error inserting patients:', error);
  } else {
    console.log('Successfully inserted all patients!');
  }
}

insertData();
