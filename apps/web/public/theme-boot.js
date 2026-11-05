try {
  var d = document.documentElement;
  d.dataset.theme = localStorage.getItem('ribat.theme') || 'emerald';
  d.dataset.pattern = localStorage.getItem('ribat.pattern') || 'on';
} catch (e) {
  document.documentElement.dataset.theme = 'emerald';
}
