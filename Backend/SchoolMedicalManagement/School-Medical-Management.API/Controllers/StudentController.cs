using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SchoolMedicalManagement.Models.Entity;
using SchoolMedicalManagement.Models.Request;
using SchoolMedicalManagement.Service.Interface;
using System.Security.Claims;

namespace School_Medical_Management.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class StudentController : ControllerBase
    {
        private readonly IStudentService _studentService;
        private readonly SwpEduHealV5Context _db;

        public StudentController(
            IStudentService studentService,
            SwpEduHealV5Context db)
        {
            _studentService = studentService;
            _db = db;
        }

        [Authorize(Roles = "Nurse,Manager")]
        [HttpGet]
        public async Task<IActionResult> GetStudentList()
        {
            var response = await _studentService.GetStudentList();
            return StatusCode(int.Parse(response.Status ?? "200"), response);
        }

        [Authorize(Roles = "Parent,Nurse,Manager")]
        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetStudentById([FromRoute] int id)
        {
            if (User.IsInRole("Parent"))
            {
                if (!TryGetCurrentUserId(out var parentId))
                    return Forbid();

                var ownsStudent = await _db.Students
                    .AsNoTracking()
                    .AnyAsync(student =>
                        student.StudentId == id &&
                        student.ParentId == parentId &&
                        student.IsActive != false);

                if (!ownsStudent)
                    return Forbid();
            }

            var response = await _studentService.GetStudentById(id);
            return StatusCode(int.Parse(response.Status), response);
        }

        [Authorize(Roles = "Nurse,Manager")]
        [HttpPost]
        public async Task<IActionResult> CreateStudent([FromBody] CreateStudentRequest request)
        {
            var response = await _studentService.CreateStudent(request);
            return StatusCode(int.Parse(response.Status), response);
        }

        [Authorize(Roles = "Nurse,Manager")]
        [HttpPut("{id:int}")]
        public async Task<IActionResult> UpdateStudent(int id, [FromBody] UpdateStudentRequest request)
        {
            var response = await _studentService.UpdateStudent(id, request);
            if (response == null || response.Data == null)
                return NotFound($"找不到學生 ID {id}，或更新失敗。");

            return StatusCode(int.Parse(response.Status ?? "200"), response);
        }

        [Authorize(Roles = "Nurse,Manager")]
        [HttpDelete("{id:int}")]
        public async Task<IActionResult> DeleteStudent([FromRoute] int id)
        {
            var response = await _studentService.DeleteStudent(id);
            return StatusCode(int.Parse(response.Status ?? "200"), response);
        }

        [Authorize(Roles = "Parent,Nurse,Manager")]
        [HttpGet("by-parent/{parentId:guid}")]
        public async Task<IActionResult> GetStudentsOfParent(Guid parentId)
        {
            if (User.IsInRole("Parent") &&
                (!TryGetCurrentUserId(out var currentParentId) || currentParentId != parentId))
            {
                return Forbid();
            }

            var response = await _studentService.GetStudentsOfParent(parentId);
            return StatusCode(int.Parse(response.Status), response);
        }

        [Authorize(Roles = "Nurse,Manager")]
        [HttpGet("by-class/{className}")]
        public async Task<IActionResult> GetStudentsByClass([FromRoute] string className)
        {
            var response = await _studentService.GetStudentsByClass(className);
            return StatusCode(int.Parse(response.Status ?? "200"), response);
        }

        private bool TryGetCurrentUserId(out Guid userId) =>
            Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out userId);
    }
}
