import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  lo: {
    translation: {
      brand: 'Sunha POS',
      greeting: 'ຍິນດີຕ້ອນຮັບ',
      description: 'ລະບົບຂາຍໜ້າຮ້ານສຳລັບທຸລະກິດຂອງທ່ານ',
      getStarted: 'ເລີ່ມຕົ້ນ',
      status: 'ພ້ອມໃຊ້ງານ',
      phoneTablet: 'ອອກແບບສຳລັບໂທລະສັບ ແລະ ແທັບເລັດ',
    },
  },
  en: {
    translation: {
      brand: 'Sunha POS',
      greeting: 'Welcome',
      description: 'A point-of-sale system for your business',
      getStarted: 'Get started',
      status: 'Ready',
      phoneTablet: 'Designed for phones and tablets',
    },
  },
} as const;

const deviceLanguage = Localization.getLocales()[0]?.languageCode;

void i18n.use(initReactI18next).init({
  resources,
  lng: deviceLanguage === 'en' ? 'en' : 'lo',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
