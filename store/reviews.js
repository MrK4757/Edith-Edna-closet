let currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');

function showReviewForm() {
  currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
  if (currentUser) {
    document.getElementById('reviewForm').style.display = 'block';
    document.getElementById('loginMessage').style.display = 'none';
    populateProductSelect();
  } else {
    document.getElementById('reviewForm').style.display = 'none';
    document.getElementById('loginMessage').style.display = 'block';
  }
}

function populateProductSelect() {
  const select = document.getElementById('reviewProduct');
  select.innerHTML = '<option value="">Select Product</option>';
  const products = JSON.parse(localStorage.getItem('products') || '[]');
  products.forEach(product => {
    const option = document.createElement('option');
    option.value = product.name;
    option.textContent = product.name;
    select.appendChild(option);
  });
}

function submitReview() {
  currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
  if (!currentUser) {
    alert('Please login to submit a review.');
    window.location.href = 'login.html';
    return;
  }
  const productName = document.getElementById('reviewProduct').value;
  const rating = document.querySelector('input[name="rating"]:checked')?.value;
  const reviewText = document.getElementById('reviewText').value;
  if (!productName || !rating || !reviewText) {
    alert('Please fill in all fields.');
    return;
  }
  const review = {
    id: Date.now(),
    productName: productName,
    userName: currentUser.name,
    rating: parseInt(rating),
    text: reviewText,
    date: new Date().toISOString()
  };
  const reviews = JSON.parse(localStorage.getItem('reviews') || '[]');
  reviews.unshift(review);
  localStorage.setItem('reviews', JSON.stringify(reviews));
  addReviewToDisplay(review);
  alert('Review submitted successfully!');
  document.getElementById('reviewText').value = '';
  document.getElementById('reviewProduct').value = '';
  const checked = document.querySelector('input[name="rating"]:checked');
  if (checked) checked.checked = false;
}

function addReviewToDisplay(review) {
  const reviewsList = document.getElementById('reviewsList');
  const reviewDiv = document.createElement('div');
  reviewDiv.className = 'review-item';
  const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
  reviewDiv.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <div><strong>${review.userName}</strong><br><small>${new Date(review.date).toLocaleString()}</small></div>
      <div style="color:#f59e0b; font-size:1.1rem;">${stars}</div>
    </div>
    <div style="margin-top:0.6rem;"><em>${review.productName}</em></div>
    <div style="margin-top:0.4rem;">${review.text}</div>
  `;
  reviewsList.insertBefore(reviewDiv, reviewsList.firstChild);
}

function loadReviews() {
  const reviews = JSON.parse(localStorage.getItem('reviews') || '[]');
  reviews.forEach(addReviewToDisplay);
}

window.addEventListener('DOMContentLoaded', () => {
  showReviewForm();
  loadReviews();
});