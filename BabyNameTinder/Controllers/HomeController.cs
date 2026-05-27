using Microsoft.AspNetCore.Mvc;

namespace BabyNameTinder.Controllers;

public class HomeController : Controller
{
    public IActionResult Index()
    {
        if (User.Identity?.IsAuthenticated == true)
            return RedirectToAction("Index", "Swipe");
        return View();
    }
}
