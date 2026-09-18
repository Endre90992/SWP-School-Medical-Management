using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace School_Medical_Management.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class EmailController : ControllerBase
    {
        [HttpPost("send-by-userid")]
        public IActionResult SendEmailByUserId()
            => StatusCode(StatusCodes.Status410Gone, new
            {
                status = "410",
                message = "EduHealth Local TW 為離線版，Email 功能已停用。"
            });

        [HttpPost("send-by-email")]
        public IActionResult SendEmailByEmail()
            => StatusCode(StatusCodes.Status410Gone, new
            {
                status = "410",
                message = "EduHealth Local TW 為離線版，Email 功能已停用。"
            });
    }
}
