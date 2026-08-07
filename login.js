async function redirectIfLoggedIn() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) window.location.href = 'dashboard.html';
}
redirectIfLoggedIn();

const form = document.getElementById('loginForm');
const errorBox = document.getElementById('loginError');
const loginBtn = document.getElementById('loginBtn');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorBox.style.display = 'none';
  loginBtn.classList.add('loading');
  loginBtn.disabled = true;

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

  loginBtn.classList.remove('loading');
  loginBtn.disabled = false;

  if (error) {
    errorBox.textContent = 'Incorrect email or password.';
    errorBox.style.display = 'block';
    return;
  }

  window.location.href = 'dashboard.html';
});
