export type FeaturedMoment = {
  day: string;
  title: string;
  text: string;
  image?: string | null;
  articleUrl?: string | null;
  type: "war" | "science" | "politics" | "culture";
  secondaryType?: string | null;
};

export const FEATURED_MOMENTS: FeaturedMoment[] = [
  // WAR
  {
    day: "1815-06-18",
    title: "Battle of Waterloo",
    text: "Napoleon is decisively defeated at Waterloo, ending his final bid for power and reshaping the political balance of Europe.",
    image:
      "https://commons.wikimedia.org/wiki/Special:Redirect/file/Battle_of_Waterloo_1815.PNG",
    articleUrl: "https://en.wikipedia.org/wiki/Battle_of_Waterloo",
    type: "war",
    secondaryType: "politics",
  },
  {
    day: "1914-07-28",
    title: "World War I begins",
    text: "Austria-Hungary declares war on Serbia, triggering the chain reaction that plunges Europe and much of the world into World War I.",
    image:
      "https://commons.wikimedia.org/wiki/Special:Redirect/file/Bundesarchiv_Bild_183-R28619,_Erster_Weltkrieg,_Soldaten_im_Sch%C3%BCtzengraben.jpg",
    articleUrl: "https://en.wikipedia.org/wiki/World_War_I",
    type: "war",
    secondaryType: "event",
  },
  {
    day: "1939-09-01",
    title: "World War II begins",
    text: "Germany invades Poland, beginning World War II and setting off one of the most devastating conflicts in human history.",
    image:
      "https://commons.wikimedia.org/wiki/Special:Redirect/file/Bundesarchiv_Bild_183-S55480,_Polen,_zerst%C3%B6rte_H%C3%A4user.jpg",
    articleUrl: "https://en.wikipedia.org/wiki/Invasion_of_Poland",
    type: "war",
    secondaryType: "politics",
  },
  {
    day: "1944-06-06",
    title: "D-Day landings",
    text: "Allied forces land in Normandy in the largest seaborne invasion in history, opening the Western Front against Nazi Germany.",
    image:
      "https://commons.wikimedia.org/wiki/Special:Redirect/file/Into_the_Jaws_of_Death_23-0455M_edit.jpg",
    articleUrl: "https://en.wikipedia.org/wiki/Normandy_landings",
    type: "war",
    secondaryType: "event",
  },
  {
    day: "2022-02-24",
    title: "Russian invasion of Ukraine",
    text: "Russia launches a full-scale invasion of Ukraine, igniting the largest military conflict in Europe in decades.",
    image:
      "https://commons.wikimedia.org/wiki/Special:Redirect/file/2022_Russian_invasion_of_Ukraine.svg",
    articleUrl: "https://en.wikipedia.org/wiki/Russian_invasion_of_Ukraine",
    type: "war",
    secondaryType: "politics",
  },

  // SCIENCE
  {
    day: "1859-11-24",
    title: "On the Origin of Species",
    text: "Charles Darwin publishes On the Origin of Species, transforming biology by popularizing the theory of evolution through natural selection.",
    image:
      "https://commons.wikimedia.org/wiki/Special:Redirect/file/Origin_of_Species_title_page.jpg",
    articleUrl: "https://en.wikipedia.org/wiki/On_the_Origin_of_Species",
    type: "science",
    secondaryType: "discovery",
  },
  {
    day: "1928-09-28",
    title: "Discovery of penicillin",
    text: "Alexander Fleming observes the antibacterial effects of penicillin, paving the way for the antibiotic revolution.",
    image:
      "https://commons.wikimedia.org/wiki/Special:Redirect/file/Alexander_Fleming_3.jpg",
    articleUrl: "https://en.wikipedia.org/wiki/Penicillin",
    type: "science",
    secondaryType: "discovery",
  },
  {
    day: "1953-04-25",
    title: "DNA structure published",
    text: "The double-helix structure of DNA is published in Nature, becoming one of the foundational breakthroughs of modern biology.",
    image:
      "https://commons.wikimedia.org/wiki/Special:Redirect/file/DNA_orbit_animated_static_thumb.png",
    articleUrl: "https://en.wikipedia.org/wiki/DNA",
    type: "science",
    secondaryType: "discovery",
  },
  {
    day: "1969-07-20",
    title: "Moon landing",
    text: "Apollo 11 lands on the Moon, marking one of humanity’s most iconic scientific and technological achievements.",
    image:
      "https://commons.wikimedia.org/wiki/Special:Redirect/file/Aldrin_Apollo_11.jpg",
    articleUrl: "https://en.wikipedia.org/wiki/Apollo_11",
    type: "science",
    secondaryType: "discovery",
  },
  {
    day: "2003-04-14",
    title: "Human Genome Project completed",
    text: "Scientists announce the successful completion of the Human Genome Project, a milestone in genetics and biomedical research.",
    image: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Chromosome.png",
    articleUrl: "https://en.wikipedia.org/wiki/Human_Genome_Project",
    type: "science",
    secondaryType: "discovery",
  },

  // POLITICS
  {
    day: "1863-01-01",
    title: "Emancipation Proclamation",
    text: "Abraham Lincoln’s Emancipation Proclamation takes effect, redefining the Civil War and advancing the abolition of slavery in the United States.",
    image:
      "https://commons.wikimedia.org/wiki/Special:Redirect/file/Emancipation_Proclamation,_NARA_scan.jpg",
    articleUrl: "https://en.wikipedia.org/wiki/Emancipation_Proclamation",
    type: "politics",
    secondaryType: "event",
  },
  {
    day: "1917-11-07",
    title: "Russian Revolution",
    text: "The Bolsheviks seize power in Petrograd, changing Russia’s future and reshaping global politics for the twentieth century.",
    image:
      "https://commons.wikimedia.org/wiki/Special:Redirect/file/7_November_1917.jpg",
    articleUrl: "https://en.wikipedia.org/wiki/October_Revolution",
    type: "politics",
    secondaryType: "event",
  },
  {
    day: "1945-10-24",
    title: "United Nations founded",
    text: "The Charter of the United Nations enters into force, creating a new international body aimed at peace, diplomacy, and cooperation.",
    image:
      "https://commons.wikimedia.org/wiki/Special:Redirect/file/UN_General_Assembly_hall.jpg",
    articleUrl: "https://en.wikipedia.org/wiki/United_Nations",
    type: "politics",
    secondaryType: "selected",
  },
  {
    day: "1989-11-09",
    title: "Fall of the Berlin Wall",
    text: "The Berlin Wall opens, becoming the defining symbol of the collapse of the Cold War order in Europe.",
    image:
      "https://commons.wikimedia.org/wiki/Special:Redirect/file/Berlin_Wall_Brandenburg_Gate.jpg",
    articleUrl: "https://en.wikipedia.org/wiki/Fall_of_the_Berlin_Wall",
    type: "politics",
    secondaryType: "discovery",
  },
  {
    day: "1994-05-10",
    title: "Mandela becomes president",
    text: "Nelson Mandela is inaugurated as President of South Africa in the country’s first fully democratic election era.",
    image:
      "https://commons.wikimedia.org/wiki/Special:Redirect/file/Nelson_Mandela-2008_(edit).jpg",
    articleUrl: "https://en.wikipedia.org/wiki/Nelson_Mandela",
    type: "politics",
    secondaryType: "selected",
  },

  // CULTURE
  {
    day: "1895-12-28",
    title: "First public film screening",
    text: "The Lumière brothers hold one of the first commercial public film screenings in Paris, marking the birth of cinema as mass entertainment.",
    image:
      "https://commons.wikimedia.org/wiki/Special:Redirect/file/Arrivee_du_train.jpg",
    articleUrl:
      "https://en.wikipedia.org/wiki/Auguste_and_Louis_Lumi%C3%A8re",
    type: "culture",
    secondaryType: "event",
  },
  {
    day: "1955-07-17",
    title: "Disneyland opens",
    text: "Disneyland opens in California, becoming one of the most influential landmarks in modern entertainment culture.",
    image:
      "https://commons.wikimedia.org/wiki/Special:Redirect/file/Disneyland_park_train_station.jpg",
    articleUrl: "https://en.wikipedia.org/wiki/Disneyland",
    type: "culture",
    secondaryType: "selected",
  },
  {
    day: "1964-02-09",
    title: "The Beatles on Ed Sullivan",
    text: "The Beatles perform on The Ed Sullivan Show, a defining moment in global pop culture and the British Invasion.",
    image: "https://commons.wikimedia.org/wiki/Special:Redirect/file/The_Fabs.JPG",
    articleUrl:
      "https://en.wikipedia.org/wiki/The_Beatles_on_The_Ed_Sullivan_Show",
    type: "culture",
    secondaryType: "event",
  },
  {
    day: "1981-08-01",
    title: "MTV launches",
    text: "MTV begins broadcasting, changing music, youth identity, and visual culture through the age of the music video.",
    image:
      "https://commons.wikimedia.org/wiki/Special:Redirect/file/MTV_1981_logo.svg",
    articleUrl: "https://en.wikipedia.org/wiki/MTV",
    type: "culture",
    secondaryType: "selected",
  },
  {
    day: "1997-06-26",
    title: "Harry Potter is published",
    text: "Harry Potter and the Philosopher’s Stone is first published, launching one of the most influential literary franchises of modern culture.",
    image:
      "https://commons.wikimedia.org/wiki/Special:Redirect/file/Harry_Potter_wordmark.svg",
    articleUrl:
      "https://en.wikipedia.org/wiki/Harry_Potter_and_the_Philosopher%27s_Stone",
    type: "culture",
    secondaryType: "event",
  },
];

export function getFeaturedMoment(day: string): FeaturedMoment | null {
  return FEATURED_MOMENTS.find((moment) => moment.day === day) ?? null;
}