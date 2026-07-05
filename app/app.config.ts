export default defineAppConfig({
  ui: {
    colors: {
      primary: 'green',
      neutral: 'slate',
    },
    // Give every card a soft shadow + clear ring so it visibly lifts off the
    // grey page background (premium depth, easy to tell card from backdrop).
    card: {
      slots: {
        root: 'bg-default ring-1 ring-default rounded-xl shadow-sm divide-y divide-default',
      },
    },
  },
})
