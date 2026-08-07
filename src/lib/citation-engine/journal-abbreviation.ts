/**
 * IEEE 期刊標準縮寫查表。
 *
 * IEEE editorial style 要求期刊名稱使用標準縮寫（例如 IEEE Trans. Educ.、
 * IEEE Trans. Learn. Technol.）。metadata 供應商（Crossref 的
 * `short-container-title`、doi.org 的 `container-title-short`）提供的縮寫
 * 不一定符合 IEEE 標準（例如會給出 "IEEE Trans. Learning Technol."），
 * 因此這裡提供一份策展過的 IEEE 期刊縮寫表，優先於供應商資料。
 *
 * 查找時以「正規化後的完整期刊名稱」為 key（小寫、去掉標點與多餘空白），
 * 因此大小寫／全形／連字號差異仍可命中。
 */

const IEEE_JOURNALS: Record<string, string> = {
  // ---- IEEE Transactions ----
  "ieee transactions on learning technologies": "IEEE Trans. Learn. Technol.",
  "ieee transactions on education": "IEEE Trans. Educ.",
  "ieee transactions on automatic control": "IEEE Trans. Autom. Control",
  "ieee transactions on communications": "IEEE Trans. Commun.",
  "ieee transactions on computers": "IEEE Trans. Comput.",
  "ieee transactions on knowledge and data engineering":
    "IEEE Trans. Knowl. Data Eng.",
  "ieee transactions on software engineering": "IEEE Trans. Softw. Eng.",
  "ieee transactions on pattern analysis and machine intelligence":
    "IEEE Trans. Pattern Anal. Mach. Intell.",
  "ieee transactions on neural networks and learning systems":
    "IEEE Trans. Neural Netw. Learn. Syst.",
  "ieee transactions on neural networks": "IEEE Trans. Neural Netw.",
  "ieee transactions on industrial electronics": "IEEE Trans. Ind. Electron.",
  "ieee transactions on industrial informatics": "IEEE Trans. Ind. Inform.",
  "ieee transactions on power systems": "IEEE Trans. Power Syst.",
  "ieee transactions on power electronics": "IEEE Trans. Power Electron.",
  "ieee transactions on signal processing": "IEEE Trans. Signal Process.",
  "ieee transactions on information theory": "IEEE Trans. Inf. Theory",
  "ieee transactions on medical imaging": "IEEE Trans. Med. Imaging",
  "ieee transactions on visualization and computer graphics":
    "IEEE Trans. Vis. Comput. Graph.",
  "ieee transactions on mobile computing": "IEEE Trans. Mob. Comput.",
  "ieee transactions on wireless communications": "IEEE Trans. Wireless Commun.",
  "ieee transactions on antennas and propagation": "IEEE Trans. Antennas Propag.",
  "ieee transactions on microwave theory and techniques":
    "IEEE Trans. Microw. Theory Techn.",
  "ieee transactions on nuclear science": "IEEE Trans. Nucl. Sci.",
  "ieee transactions on reliability": "IEEE Trans. Reliab.",
  "ieee transactions on very large scale integration vlsi systems":
    "IEEE Trans. Very Large Scale Integr. (VLSI) Syst.",
  "ieee transactions on aerospace and electronic systems":
    "IEEE Trans. Aerosp. Electron. Syst.",
  "ieee transactions on biomedical engineering": "IEEE Trans. Biomed. Eng.",
  "ieee transactions on circuits and systems i regular papers":
    "IEEE Trans. Circuits Syst. I Regul. Pap.",
  "ieee transactions on circuits and systems ii express briefs":
    "IEEE Trans. Circuits Syst. II Express Briefs",
  "ieee transactions on circuits and systems": "IEEE Trans. Circuits Syst.",
  "ieee transactions on cybernetics": "IEEE Trans. Cybern.",
  "ieee transactions on energy conversion": "IEEE Trans. Energy Convers.",
  "ieee transactions on fuzzy systems": "IEEE Trans. Fuzzy Syst.",
  "ieee transactions on geoscience and remote sensing":
    "IEEE Trans. Geosci. Remote Sens.",
  "ieee transactions on image processing": "IEEE Trans. Image Process.",
  "ieee transactions on intelligent transportation systems":
    "IEEE Trans. Intell. Transp. Syst.",
  "ieee transactions on instrumentation and measurement":
    "IEEE Trans. Instrum. Meas.",
  "ieee transactions on magnetics": "IEEE Trans. Magn.",
  "ieee transactions on plasma science": "IEEE Trans. Plasma Sci.",
  "ieee transactions on robotics": "IEEE Trans. Robot.",
  "ieee transactions on systems man and cybernetics systems":
    "IEEE Trans. Syst. Man Cybern. Syst.",
  "ieee transactions on systems man and cybernetics part b cybernetics":
    "IEEE Trans. Syst. Man Cybern. B",
  "ieee transactions on ultrasonics ferroelectrics and frequency control":
    "IEEE Trans. Ultrason. Ferroelectr. Freq. Control",
  "ieee transactions on vehicular technology": "IEEE Trans. Veh. Technol.",
  "ieee transactions on consumer electronics": "IEEE Trans. Consum. Electron.",
  "ieee transactions on parallel and distributed systems":
    "IEEE Trans. Parallel Distrib. Syst.",
  "ieee transactions on cloud computing": "IEEE Trans. Cloud Comput.",
  "ieee transactions on dependable and secure computing":
    "IEEE Trans. Dependable Secure Comput.",
  "ieee transactions on network and service management":
    "IEEE Trans. Netw. Serv. Manag.",
  "ieee transactions on network science and engineering":
    "IEEE Trans. Netw. Sci. Eng.",
  "ieee transactions on services computing": "IEEE Trans. Serv. Comput.",
  "ieee transactions on sustainable energy": "IEEE Trans. Sustain. Energy",
  "ieee transactions on smart grid": "IEEE Trans. Smart Grid",
  "ieee transactions on evolutionary computation": "IEEE Trans. Evol. Comput.",
  "ieee transactions on emerging topics in computing":
    "IEEE Trans. Emerg. Top. Comput.",
  "ieee transactions on affective computing": "IEEE Trans. Affect. Comput.",
  "ieee transactions on haptics": "IEEE Trans. Haptics",
  "ieee transactions on audio speech and language processing":
    "IEEE Trans. Audio Speech Lang. Process.",
  "ieee transactions on artificial intelligence": "IEEE Trans. Artif. Intell.",
  "ieee transactions on engineering management": "IEEE Trans. Eng. Manag.",
  "ieee transactions on professional communication":
    "IEEE Trans. Prof. Commun.",
  "ieee transactions on semiconductor manufacturing":
    "IEEE Trans. Semicond. Manuf.",
  "ieee transactions on applied superconductivity":
    "IEEE Trans. Appl. Supercond.",
  "ieee transactions on dielectrics and electrical insulation":
    "IEEE Trans. Dielectr. Electr. Insul.",
  "ieee transactions on electromagnetic compatibility":
    "IEEE Trans. Electromagn. Compat.",
  "ieee transactions on electron devices": "IEEE Trans. Electron Devices",
  "ieee transactions on components packaging and manufacturing technology":
    "IEEE Trans. Compon. Packag. Manuf. Technol.",
  "ieee transactions on device and materials reliability":
    "IEEE Trans. Device Mater. Reliab.",
  "ieee transactions on broadcasting": "IEEE Trans. Broadcast.",
  "ieee transactions on computers in education": "IEEE Trans. Comput. Educ.",

  // ---- IEEE Journals / Magazines / Letters ----
  "ieee access": "IEEE Access",
  "ieee journal of selected topics in signal processing":
    "IEEE J. Sel. Top. Signal Process.",
  "ieee journal on selected areas in communications":
    "IEEE J. Sel. Areas Commun.",
  "ieee journal of solid state circuits": "IEEE J. Solid-State Circuits",
  "ieee communications magazine": "IEEE Commun. Mag.",
  "ieee communications letters": "IEEE Commun. Lett.",
  "ieee signal processing magazine": "IEEE Signal Process. Mag.",
  "ieee signal processing letters": "IEEE Signal Process. Lett.",
  "ieee robotics and automation letters": "IEEE Robot. Autom. Lett.",
  "ieee internet of things journal": "IEEE Internet Things J.",
  "ieee internet computing": "IEEE Internet Comput.",
  "ieee photonics technology letters": "IEEE Photon. Technol. Lett.",
  "ieee photonics journal": "IEEE Photon. J.",
  "ieee electron device letters": "IEEE Electron Device Lett.",
  "ieee sensors journal": "IEEE Sensors J.",
  "ieee microwave and wireless components letters":
    "IEEE Microw. Wireless Compon. Lett.",
  "ieee wireless communications letters": "IEEE Wireless Commun. Lett.",
  "ieee control systems magazine": "IEEE Control Syst. Mag.",
  "ieee annals of the history of computing": "IEEE Ann. Hist. Comput.",
  "ieee computational intelligence magazine": "IEEE Comput. Intell. Mag.",
  "ieee technology and society magazine": "IEEE Technol. Soc. Mag.",
  "ieee pulse": "IEEE Pulse",
  "ieee/acm transactions on networking": "IEEE/ACM Trans. Netw.",
  "ieee/acm transactions on computational biology and bioinformatics":
    "IEEE/ACM Trans. Comput. Biol. Bioinform.",
}

// 常用非 IEEE 期刊（教育／心理／一般科學領域常見標的）
const COMMON_JOURNALS: Record<string, string> = {
  "computers & education": "Comput. Educ.",
  "computers and education": "Comput. Educ.",
  "journal of learning analytics": "J. Learn. Anal.",
  "british journal of educational technology": "Br. J. Educ. Technol.",
  "educational technology & society": "Educ. Technol. Soc.",
  "educational technology and society": "Educ. Technol. Soc.",
  "international journal of artificial intelligence in education":
    "Int. J. Artif. Intell. Educ.",
  "the internet and higher education": "Internet High. Educ.",
  "journal of educational psychology": "J. Educ. Psychol.",
  "review of educational research": "Rev. Educ. Res.",
  "educational researcher": "Educ. Res.",
  "american educational research journal": "Am. Educ. Res. J.",
  "computers in human behavior": "Comput. Hum. Behav.",
  "science": "Science",
  "nature": "Nature",
  "nature communications": "Nat. Commun.",
  "nature neuroscience": "Nat. Neurosci.",
  "plos one": "PLoS ONE",
  "proceedings of the national academy of sciences of the united states of america":
    "Proc. Natl. Acad. Sci. U.S.A.",
  "proceedings of the national academy of sciences": "Proc. Natl. Acad. Sci. U.S.A.",
  "psychological science": "Psychol. Sci.",
  "journal of applied psychology": "J. Appl. Psychol.",
  "memory & cognition": "Mem. Cognit.",
  "memory and cognition": "Mem. Cognit.",
  "journal of computer assisted learning": "J. Comput. Assist. Learn.",
  "educational psychologist": "Educ. Psychol.",
  "studies in higher education": "Stud. High. Educ.",
  "higher education": "High. Educ.",
  "assessment & evaluation in higher education": "Assess. Eval. High. Educ.",
  "international journal of educational technology in higher education":
    "Int. J. Educ. Technol. High. Educ.",
  "interactive learning environments": "Interact. Learn. Environ.",
  "learning and instruction": "Learn. Instr.",
  "research in higher education": "Res. High. Educ.",
  "active learning in higher education": "Act. Learn. High. Educ.",
}

function normalizeJournalName(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[&+]|\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s&+]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * 回傳 IEEE 標準期刊縮寫；查不到時回傳 undefined。
 */
export function abbreviateJournal(fullTitle: string): string | undefined {
  const key = normalizeJournalName(fullTitle)
  if (!key) {
    return undefined
  }

  return IEEE_JOURNALS[key] ?? COMMON_JOURNALS[key]
}

/**
 * 回傳應放入 CSL `container-title-short` 的期刊縮寫。
 *
 * 優先採用本專案策展的 IEEE 標準縮寫；否則使用供應商提供的縮寫
 * （doi.org `container-title-short`、Crossref `short-container-title`）；
 * 兩者皆無時回傳 undefined，讓 CSL 沿用完整期刊名稱。
 */
export function resolveContainerTitleShort(
  fullTitle: string | undefined,
  providerShort: string | undefined
): string | undefined {
  const curated = fullTitle ? abbreviateJournal(fullTitle) : undefined
  if (curated) {
    return curated
  }

  if (providerShort && providerShort.trim()) {
    return providerShort.trim()
  }

  return undefined
}
