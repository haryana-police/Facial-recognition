using System;
using System.ComponentModel.DataAnnotations.Schema;

namespace ForensicBackend.Models
{
    [Table("suspect")]
    public class Suspect
    {
        [Column("id")]
        public int Id { get; set; }

        [Column("name")]
        public string Name { get; set; }

        [Column("embedding_vector")]
        public string FaceEmbedding { get; set; }

        [Column("image_path")]
        public string ImagePath { get; set; }
    }
}
