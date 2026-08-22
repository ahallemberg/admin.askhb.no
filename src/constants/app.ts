const R2_GET_ENDPOINT = "https://r2.askhb.no"
const R2_PUT_ENDPOINT = "https://worker.askhb.no"

const EDUCATION_PATH = "/education.json"
const EXPERIENCE_PATH = "/experiences.json"
const PERSONAL_INFO_PATH = "/personalinfo.json"
const CV_PATH = "/cv.pdf"
const PROJECTS_PATH = "/projects.json"

// Uploaded images are keyed by directory so a logo can never collide with a
// screenshot of the same name.
const LOGO_DIR = "/logos/"
const SCREENSHOT_DIR = "/screenshots/"

// The site's header image. Not editable here -- it is replaced in the bucket
// directly -- but the personal info preview renders it, because the name and
// title below it are sized against it.
const R2_PROFILE_PICTURE = R2_GET_ENDPOINT + "/profilepicture.png"

const PAGES_BASE_URL = "https://pages.askhb.no"
const PAGES_CONTENT_INDEX_URL = PAGES_BASE_URL + "/static/contentIndex.json"

export { R2_GET_ENDPOINT, EDUCATION_PATH, EXPERIENCE_PATH, PERSONAL_INFO_PATH, CV_PATH, R2_PUT_ENDPOINT, PAGES_BASE_URL, PAGES_CONTENT_INDEX_URL, PROJECTS_PATH, LOGO_DIR, SCREENSHOT_DIR, R2_PROFILE_PICTURE }