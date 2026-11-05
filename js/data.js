/* =========================================================================
   data.js
   Single source of truth for everything I edit by hand.
   ========================================================================= */
window.DATA = {

  /* -----------------------------------------------------------------------
     PROJECT COUNT
     Hardcoded on purpose. Update it manually every time I add a project.
     ----------------------------------------------------------------------- */
  TODO_PROJECT_COUNT: 8,

  /* -----------------------------------------------------------------------
     WHATSAPP
     Digits only, with country code, no plus sign and no spaces.
     ----------------------------------------------------------------------- */
  WHATSAPP: '213652212137',

  /* -----------------------------------------------------------------------
     SUPABASE (optional)
     Leave both strings empty until the tables from supabase.sql exist.
     When they are empty the whole site still works: likes and follows are
     saved locally only and the visitor never sees a difference.
     ----------------------------------------------------------------------- */
  SUPABASE_URL: 'https://jlqljybplywlgocvnxvd.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpscWxqeWJwbHl3bGdvY3ZueHZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM5MTY1MDAsImV4cCI6MjEwOTQ5MjUwMH0.Im-uTAef3fCbIMyMpmYPJL6dUZWEqxjCv9-SheKhry8',

  /* -----------------------------------------------------------------------
     CONTACT LINKS
     Replace every "TODO" href with the real link. "TODO" tiles are inert.
     icon must be a key from icons.js.
     ----------------------------------------------------------------------- */
  SOCIALS: [
    { id: 'email',     labelKey: 'labelEmail',     icon: 'gmail',     href: 'mailto:makeitselfmits@gmail.com' },
    { id: 'whatsapp',  labelKey: 'labelWhatsApp',  icon: 'whatsapp',  href: 'https://wa.me/213652212137' },
    { id: 'linkedin',  labelKey: 'labelLinkedIn',  icon: 'linkedin',  href: 'https://www.linkedin.com/in/riyad-mallek-165aa63a7?utm_source=share_via&utm_content=profile&utm_medium=member_android' },
    { id: 'instagram', labelKey: 'labelInstagram', icon: 'instagram', href: 'https://www.instagram.com/t3lb_riyad/' },
    { id: 'tiktok',    labelKey: 'labelTikTok',    icon: 'tiktok',    href: 'https://www.tiktok.com/@t3lb_riyad' },
    { id: 'facebook',  labelKey: 'labelFacebook',  icon: 'facebook',  href: 'https://www.facebook.com/share/1D8MvmgeNu/' },
    { id: 'telegram',  labelKey: 'labelTelegram',  icon: 'telegram',  href: 'https://t.me/t3lb_riyad' },
    { id: 'phone',     labelKey: 'labelPhone',     icon: 'phone',     href: 'tel:+213652212137' }
  ],

  /* -----------------------------------------------------------------------
     SKILLS
     Add or remove entries freely. icon must be a key from icons.js.
     The certificates message is generated from these names.
     ----------------------------------------------------------------------- */
  SKILLS: [
    { name: 'JavaScript', icon: 'js' },
    { name: 'CSS', icon: 'css' },
    { name: 'HTML', icon: 'html' },
    { name: 'Automation & AI Automation', icon: 'automation' }
  ]
};
