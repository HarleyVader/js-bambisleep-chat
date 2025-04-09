export class ViewController {
  renderHome(req, res) {
    res.render('pages/home', { title: 'Home' });
  }

  renderDashboard(req, res) {
    res.render('pages/dashboard', { title: 'Dashboard' });
  }
}