using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace School_Medical_Management.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "Nurse,Manager")]
    public class EmailController : ControllerBase
    {
        [HttpPost("send-by-userid")]
        public IActionResult SendEmailByUserId()
            => StatusCode(StatusCodes.Status410Gone, new
            {
                status = "410",
                message = "EduHealth Local TW 為離線版，已停用 Email 功能。"
            });

        [HttpPost("send-by-email")]
        public IActionResult SendEmailByEmail()
            => StatusCode(StatusCodes.Status410Gone, new
            {
                status = "410",
                message = "EduHealth Local TW 為離線版，已停用 Email 功能。"
            });
    }
}
