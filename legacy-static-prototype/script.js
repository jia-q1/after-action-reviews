const reviewItems = document.querySelectorAll('.doc-item');
const titleEl = document.getElementById('selected-title');
const summaryEl = document.getElementById('selected-summary');
const eventEl = document.getElementById('selected-event');
const dateEl = document.getElementById('selected-date');
const ownerEl = document.getElementById('selected-owner');
const bodyEl = document.getElementById('selected-body');

reviewItems.forEach((item) => {
  item.addEventListener('click', () => {
    reviewItems.forEach((entry) => entry.classList.remove('active'));
    item.classList.add('active');

    titleEl.textContent = item.dataset.title;
    summaryEl.textContent = item.dataset.summary;
    eventEl.textContent = item.dataset.event;
    dateEl.textContent = item.dataset.date;
    ownerEl.textContent = item.dataset.owner;
    bodyEl.textContent = item.dataset.body;
  });
});
