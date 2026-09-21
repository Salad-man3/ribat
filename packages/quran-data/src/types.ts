export type AyahRef = {
  surah: number;
  ayah: number;
};

export type AyahRange = {
  start: AyahRef;
  end: AyahRef;
};

export type Surah = {
  number: number;
  nameAr: string;
  nameEn: string;
  ayahCount: number;
};

export type PageRange = {
  from: number;
  to: number;
};
