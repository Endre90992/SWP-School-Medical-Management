using SchoolMedicalManagement.Models.Entity;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;

namespace SchoolMedicalManagement.Repository.Repository
{
    public class HealthCheckCampaignRepository : GenericRepository<HealthCheckCampaign>
    {
        public HealthCheckCampaignRepository(SwpEduHealV5Context context) : base(context)
        {
        }

        // Lấy tất cả các chiến dịch khám sức khỏe
        public async Task<List<HealthCheckCampaign>> GetAllHealthCheckCampaigns()
        => await _context.HealthCheckCampaigns
            .AsNoTracking()
            .Include(c => c.CreatedByNavigation)
            .Include(c => c.Status)
            .ToListAsync();

        // Lấy chiến dịch khám sức khỏe theo id
        public async Task<HealthCheckCampaign?> GetHealthCheckCampaignById(int id)
        => await _context.HealthCheckCampaigns
            .Include(c => c.CreatedByNavigation)
            .Include(c => c.Status)
            .FirstOrDefaultAsync(c => c.CampaignId == id);

        public Task<List<HealthCheckCampaign>> GetHealthCheckCampaignsByStatusAsync(int statusId)
            => _context.HealthCheckCampaigns
                .AsNoTracking()
                .Include(c => c.CreatedByNavigation)
                .Include(c => c.Status)
                .Where(c => c.StatusId == statusId)
                .ToListAsync();

        // Tạo mới chiến dịch khám sức khỏe
        public async Task<HealthCheckCampaign?> CreateHealthCheckCampaign(HealthCheckCampaign campaign)
        {
            await CreateAsync(campaign);
            return await GetHealthCheckCampaignById(campaign.CampaignId);
        }

        // Cập nhật chiến dịch khám sức khỏe
        public async Task<HealthCheckCampaign?> UpdateHealthCheckCampaign(HealthCheckCampaign campaign)
        {
            await UpdateAsync(campaign);
            return await GetHealthCheckCampaignById(campaign.CampaignId);
        }

        // Xóa chiến dịch khám sức khỏe
        public async Task<bool> DeleteHealthCheckCampaign(int id)
        {
            var campaign = await GetHealthCheckCampaignById(id);
            if (campaign == null)
            {
                return false;
            }
            return await RemoveAsync(campaign);
        }

        // Get total count of health check campaigns
        public async Task<int> GetTotalHealthCheckCampaignsCount()
        {
            return await _context.HealthCheckCampaigns.CountAsync();
        }

        // Get count of active health check campaigns
        public async Task<int> GetActiveHealthCheckCampaignsCount()
        {
            return await _context.HealthCheckCampaigns.CountAsync(c => c.StatusId == 2);
        }

        public async Task<Dictionary<int, int>> GetStatusCountsAsync()
        {
            return await _context.HealthCheckCampaigns
                .AsNoTracking()
                .GroupBy(c => c.StatusId ?? 0)
                .Select(g => new { StatusId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.StatusId, x => x.Count);
        }
    }
}
