import useTranslation from '../hooks/useTranslation.js'

export default function LanguageToggle({ compact = false }) {
  const { lang, toggleLang: toggle } = useTranslation()

  if (compact) {
    return (
      <button
        onClick={toggle}
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
        title={lang === 'en' ? 'Switch to Kiswahili' : 'Switch to English'}
      >
        <span className="text-base">{lang === 'en' ? '🇰🇪' : '🇬🇧'}</span>
        <span className="text-xs font-bold uppercase">{lang === 'en' ? 'SW' : 'EN'}</span>
      </button>
    )
  }

  return (
    <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5">
      <button
        onClick={() => lang !== 'en' && toggle()}
        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
          lang === 'en'
            ? 'bg-white text-emerald-700 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        EN
      </button>
      <button
        onClick={() => lang !== 'sw' && toggle()}
        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
          lang === 'sw'
            ? 'bg-white text-emerald-700 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        SW
      </button>
    </div>
  )
}