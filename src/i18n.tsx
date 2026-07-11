import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

type Language = 'en' | 'es'

type TranslationDictionary = Record<string, string>

const translations: Record<Language, TranslationDictionary> = {
  en: {
    'app.backToHome': 'Back to home',
    'app.selectFolder': 'Select folder',
    'common.cancel': 'Cancel',
    'common.loadingDisks': 'Detecting drives...',
    'common.total': 'total',
    'detail.extension': 'Extension',
    'detail.fullPath': 'Full path',
    'detail.items': 'Items',
    'detail.percentage': 'Percentage',
    'detail.proportion': 'Directory share',
    'detail.size': 'Size',
    'detail.title': 'Details',
    'detail.type': 'Type',
    'detail.modified': 'Modified',
    'detail.reveal': 'Show in folder',
    'detail.trash': 'Move to trash',
    'detail.trashConfirm': 'Confirm delete?',
    'detail.trashDone': 'Moved to trash — rescan to refresh sizes',
    'detail.trashError': 'Could not move to trash',
    'disk.available': 'Available drives',
    'disk.freeOfTotal': '{{free}} free of {{total}}',
    'disk.selectOther': 'Select another folder...',
    'disk.used': '{{used}} used',
    'file.directory': 'Folder',
    'file.emptyFolder': 'This folder is empty',
    'file.file': 'File',
    'file.name': 'Name',
    'file.noAccess': 'No access (permissions)',
    'file.size': 'Size',
    'language.english': 'English',
    'language.label': 'Language',
    'language.spanish': 'Español',
    'results.backToRoot': 'Back to root',
    'results.export': 'Export',
    'results.exported': 'Saved ✓',
    'results.filterPlaceholder': 'Filter by name…',
    'results.rescan': 'Rescan',
    'results.topFiles': 'Top files',
    'theme.switchToDark': 'Switch to dark mode',
    'theme.switchToLight': 'Switch to light mode',
    'results.list': 'List',
    'results.legend': 'Color legend',
    'results.treemap': 'Treemap',
    'scan.filesScanned': '{{count}} files scanned',
    'scan.title': 'Scanning...',
    'welcome.description': 'Select a drive or folder to visualize how space is distributed. GreekDir shows an interactive map of your files.',
    'welcome.featureBrowse': 'Navigation',
    'welcome.featureBrowseDescription': 'Explore subfolders instantly',
    'welcome.featureList': 'Detailed list',
    'welcome.featureListDescription': 'Files sorted by size',
    'welcome.featureTreemap': 'Visual treemap',
    'welcome.featureTreemapDescription': 'Block map proportional to file size',
    'welcome.title': 'Analyze your disk usage',
    'welcome.includeHidden': 'Include hidden and system folders (.git, node_modules…)',
    'category.archives': 'Archives',
    'category.audio': 'Audio',
    'category.code': 'Code',
    'category.data': 'Data',
    'category.directories': 'Directories',
    'category.documents': 'Documents',
    'category.executables': 'Executables',
    'category.images': 'Images',
    'category.other': 'Other',
    'category.videos': 'Videos',
  },
  es: {
    'app.backToHome': 'Volver al inicio',
    'app.selectFolder': 'Seleccionar carpeta',
    'common.cancel': 'Cancelar',
    'common.loadingDisks': 'Detectando discos...',
    'common.total': 'total',
    'detail.extension': 'Extensión',
    'detail.fullPath': 'Ruta completa',
    'detail.items': 'Elementos',
    'detail.percentage': 'Porcentaje',
    'detail.proportion': 'Proporción del directorio',
    'detail.size': 'Tamaño',
    'detail.title': 'Detalles',
    'detail.type': 'Tipo',
    'detail.modified': 'Modificado',
    'detail.reveal': 'Mostrar en carpeta',
    'detail.trash': 'Mover a la papelera',
    'detail.trashConfirm': '¿Confirmar borrado?',
    'detail.trashDone': 'Movido a la papelera — reescanea para actualizar',
    'detail.trashError': 'No se pudo mover a la papelera',
    'disk.available': 'Discos disponibles',
    'disk.freeOfTotal': '{{free}} libres de {{total}}',
    'disk.selectOther': 'Seleccionar otra carpeta...',
    'disk.used': '{{used}} usados',
    'file.directory': 'Carpeta',
    'file.emptyFolder': 'Esta carpeta está vacía',
    'file.file': 'Archivo',
    'file.name': 'Nombre',
    'file.noAccess': 'Sin acceso (permisos)',
    'file.size': 'Tamaño',
    'language.english': 'English',
    'language.label': 'Idioma',
    'language.spanish': 'Español',
    'results.backToRoot': 'Volver a la raíz',
    'results.export': 'Exportar',
    'results.exported': 'Guardado ✓',
    'results.filterPlaceholder': 'Filtrar por nombre…',
    'results.rescan': 'Reescanear',
    'results.topFiles': 'Top archivos',
    'theme.switchToDark': 'Cambiar a modo oscuro',
    'theme.switchToLight': 'Cambiar a modo claro',
    'results.list': 'Lista',
    'results.legend': 'Leyenda de colores',
    'results.treemap': 'Treemap',
    'scan.filesScanned': '{{count}} archivos escaneados',
    'scan.title': 'Analizando...',
    'welcome.description': 'Selecciona un disco o carpeta para visualizar cómo se distribuye el espacio. GreekDir muestra un mapa interactivo de tus archivos.',
    'welcome.featureBrowse': 'Navegación',
    'welcome.featureBrowseDescription': 'Explora subcarpetas al instante',
    'welcome.featureList': 'Lista detallada',
    'welcome.featureListDescription': 'Archivos ordenados por tamaño',
    'welcome.featureTreemap': 'Treemap visual',
    'welcome.featureTreemapDescription': 'Mapa de bloques proporcional al tamaño',
    'welcome.title': 'Analiza el uso de tus discos',
    'welcome.includeHidden': 'Incluir carpetas ocultas y de sistema (.git, node_modules…)',
    'category.archives': 'Archivos comprimidos',
    'category.audio': 'Audio',
    'category.code': 'Código',
    'category.data': 'Datos',
    'category.directories': 'Directorios',
    'category.documents': 'Documentos',
    'category.executables': 'Ejecutables',
    'category.images': 'Imágenes',
    'category.other': 'Otros',
    'category.videos': 'Videos',
  },
}

interface I18nContextValue {
  language: Language
  setLanguage: (language: Language) => void
  t: (key: string, variables?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined)

function interpolate(
  template: string,
  variables: Record<string, string | number> = {}
): string {
  return Object.entries(variables).reduce((result, [key, value]) => {
    return result.split(`{{${key}}}`).join(String(value))
  }, template)
}

const LANGUAGE_STORAGE_KEY = 'greekdir-language'

function getInitialLanguage(): Language {
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY)
  if (stored === 'en' || stored === 'es') return stored
  // First run: follow the OS language.
  return navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(getInitialLanguage)

  useEffect(() => {
    document.documentElement.lang = language
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  }, [language])

  const value = useMemo<I18nContextValue>(() => ({
    language,
    setLanguage,
    t: (key, variables) => {
      const template = translations[language][key] ?? translations.en[key] ?? key
      return interpolate(template, variables)
    },
  }), [language])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)

  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider')
  }

  return context
}
